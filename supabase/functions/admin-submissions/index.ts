// @ts-nocheck
import { createClient } from "supabase";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { Ratelimit } from "npm:@upstash/ratelimit";
import { Redis } from "npm:@upstash/redis";

const deleteSchema = z.object({
  id: z.string().uuid()
});

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("FRONTEND_URL") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAdminClient(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Rate Limiting
  try {
    const upstashUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
    const upstashToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
    if (upstashUrl && upstashToken) {
      const redis = new Redis({ url: upstashUrl, token: upstashToken });
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "60 s"),
      });
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
      const { success } = await ratelimit.limit(`ratelimit_submissions_${ip}`);
      if (!success) {
        throw new Error("RATE_LIMIT_EXCEEDED");
      }
    }
  } catch (err) {
    if (err.message === "RATE_LIMIT_EXCEEDED") throw err;
    console.error("Rate limit check failed", err);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Unauthorized");

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: isAdmin } = await adminClient.rpc("is_admin", { _user_id: user.id });
  if (!isAdmin) throw new Error("Forbidden");

  return { adminClient, userId: user.id };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { adminClient, userId } = await getAdminClient(req);

    // DELETE submission
    if (req.method === "DELETE") {
      let body;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: corsHeaders });
      }

      const parsed = deleteSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: "Invalid payload format", details: parsed.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { id } = parsed.data;

      const { data: submissionData } = await adminClient.from("submissions").select("*").eq("id", id).single();

      const { error } = await adminClient.from("submissions").delete().eq("id", id);
      if (error) throw error;

      if (submissionData) {
        await adminClient.from("audit_logs").insert({
          admin_id: userId,
          action: "DELETE_SUBMISSION",
          entity_name: "submissions",
          entity_id: id,
          details: submissionData
        });
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET submissions with pagination
    const url = new URL(req.url);
    const collegeId = url.searchParams.get("college_id");
    const status = url.searchParams.get("status");
    const userId = url.searchParams.get("user_id");
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(20, parseInt(url.searchParams.get("limit") || "50", 10)));
    const offset = (page - 1) * limit;

    let query = adminClient
      .from("submissions")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (collegeId && collegeId !== "all") query = query.eq("college_id", collegeId);
    if (status && status !== "all") query = query.eq("status", status);
    if (userId) query = query.eq("user_id", userId);

    const { data, error, count } = await query;
    if (error) throw error;

    // Fetch profiles and colleges separately
    const userIds = [...new Set((data || []).map((s: any) => s.user_id))];
    const collegeIds = [...new Set((data || []).map((s: any) => s.college_id))];

    const [profilesRes, collegesRes] = await Promise.all([
      userIds.length > 0
        ? adminClient.from("profiles").select("user_id, full_name, email, roll_no").in("user_id", userIds)
        : { data: [] },
      collegeIds.length > 0
        ? adminClient.from("colleges").select("id, name").in("id", collegeIds)
        : { data: [] },
    ]);

    const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p]));
    const collegeMap = new Map((collegesRes.data || []).map((c: any) => [c.id, c]));

    const submissions = (data || []).map((s: any) => {
      const profile = profileMap.get(s.user_id) as any;
      const college = collegeMap.get(s.college_id) as any;
      return {
        ...s,
        student_name: profile?.full_name || "Unknown",
        student_email: profile?.email || "",
        student_roll_no: profile?.roll_no || "",
        college_name: college?.name || "Unknown",
      };
    });

    return new Response(JSON.stringify({
      submissions,
      total: count ?? 0,
      page,
      limit,
      totalPages: count != null ? Math.ceil(count / limit) : 1,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("Admin submissions error:", e);
    const status = e.message === "Unauthorized" ? 401
      : e.message === "Forbidden" ? 403
        : e.message === "RATE_LIMIT_EXCEEDED" ? 429
          : 500;
    const msg = e.message === "RATE_LIMIT_EXCEEDED" ? "Too many requests. Please try again later."
      : status === 500 ? "An internal server error occurred."
        : e.message;
    return new Response(JSON.stringify({ error: msg }), { status, headers: corsHeaders });
  }
});
