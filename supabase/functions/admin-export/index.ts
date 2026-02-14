import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const url = new URL(req.url);
    const collegeId = url.searchParams.get("college_id");

    let query = adminClient
      .from("profiles")
      .select("full_name, roll_no, total_submissions, college_id, colleges(name)")
      .order("full_name", { ascending: true });

    if (collegeId && collegeId !== "all") query = query.eq("college_id", collegeId);

    const { data, error } = await query;
    if (error) throw error;

    // CSV: Student Name, Roll No, Number of Submissions, Marks (floor(submissions / 3))
    const headers = ["Student Name", "Roll No", "Number of Submissions", "Marks"];
    const rows = (data || []).map((d: any) => {
      const subs = d.total_submissions || 0;
      const marks = Math.floor(subs / 3);
      return [
        `"${(d.full_name || "").replace(/"/g, '""')}"`,
        `"${(d.roll_no || "").replace(/"/g, '""')}"`,
        subs,
        marks,
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=submissions_report.csv",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
