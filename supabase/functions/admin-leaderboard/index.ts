// @ts-nocheck
import { createClient } from "supabase";
import { Ratelimit } from "npm:@upstash/ratelimit";
import { Redis } from "npm:@upstash/redis";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("FRONTEND_URL") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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
          limiter: Ratelimit.slidingWindow(5, "60 s"),
        });
        const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
        const { success } = await ratelimit.limit(`ratelimit_leaderboard_${ip}`);
        if (!success) {
          return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }
    } catch (err) {
      console.error("Rate limit check failed", err);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await adminClient.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    // Parse filters
    const url = new URL(req.url);
    const collegeId = url.searchParams.get("college_id");
    const dateFrom = url.searchParams.get("date_from");
    const dateTo = url.searchParams.get("date_to");

    let query = adminClient
      .from("profiles")
      .select("user_id, full_name, college_id, total_submissions, correct_submissions, score, updated_at, colleges(name)")
      .gt("total_submissions", 0)
      .order("score", { ascending: false })
      .order("updated_at", { ascending: true });

    if (collegeId && collegeId !== "all") query = query.eq("college_id", collegeId);
    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59Z");

    const { data, error } = await query;
    if (error) throw error;

    const entries = (data || []).map((d: any, i: number) => ({
      rank: i + 1,
      full_name: d.full_name,
      college_name: d.colleges?.name || "Unknown",
      college_id: d.college_id,
      total_submissions: d.total_submissions,
      correct_submissions: d.correct_submissions,
      score: d.score,
      updated_at: d.updated_at,
    }));

    return new Response(JSON.stringify(entries), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("Admin leaderboard error:", e);
    return new Response(JSON.stringify({ error: "An internal server error occurred." }), { status: 500, headers: corsHeaders });
  }
});
