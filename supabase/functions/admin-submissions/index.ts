import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
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

    // GET submissions
    const url = new URL(req.url);
    const collegeId = url.searchParams.get("college_id");
    const status = url.searchParams.get("status");
    const userId = url.searchParams.get("user_id");

    let query = adminClient
      .from("submissions")
      .select("*, profiles!submissions_user_id_fkey(full_name, email, roll_no), colleges!submissions_college_id_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(500);

    if (collegeId && collegeId !== "all") query = query.eq("college_id", collegeId);
    if (status && status !== "all") query = query.eq("status", status);
    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query;
    if (error) throw error;

    const submissions = (data || []).map((s: any) => ({
      ...s,
      student_name: s.profiles?.full_name || "Unknown",
      student_email: s.profiles?.email || "",
      student_roll_no: s.profiles?.roll_no || "",
      college_name: s.colleges?.name || "Unknown",
      profiles: undefined,
      colleges: undefined,
    }));

    return new Response(JSON.stringify(submissions), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const status = e.message === "Unauthorized" ? 401 : e.message === "Forbidden" ? 403 : 500;
    return new Response(JSON.stringify({ error: e.message }), { status, headers: corsHeaders });
  }
});
