// @ts-nocheck
import { createClient } from "supabase";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAdminClient(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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

  return adminClient;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const adminClient = await getAdminClient(req);

    // DELETE submission
    if (req.method === "DELETE") {
      const { id } = await req.json();
      if (!id) return new Response(JSON.stringify({ error: "Missing submission id" }), { status: 400, headers: corsHeaders });

      const { error } = await adminClient.from("submissions").delete().eq("id", id);
      if (error) throw error;

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
    const status = e.message === "Unauthorized" ? 401 : e.message === "Forbidden" ? 403 : 500;
    return new Response(JSON.stringify({ error: e.message }), { status, headers: corsHeaders });
  }
});
