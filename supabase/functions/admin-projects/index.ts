import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LEVEL_WEIGHTS: Record<string, number> = {
  Beginner: 0.25,
  Intermediate: 0.50,
  Advanced: 0.75,
  Mixed: 0.60,
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

    if (req.method === "PUT") {
      // Update a project's level and weight
      const { id, level, weight } = await req.json();
      if (!id) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers: corsHeaders });

      const { error } = await adminClient.from("projects").update({ level, weight }).eq("id", id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET: Sync unique projects from submissions then return all
    // 1. Fetch all distinct coursera_course values from submissions
    const { data: submissions, error: subErr } = await adminClient
      .from("submissions")
      .select("coursera_course")
      .not("coursera_course", "is", null)
      .neq("coursera_course", "");

    if (subErr) throw subErr;

    const uniqueCourses = [...new Set((submissions || []).map((s: any) => s.coursera_course?.trim()).filter(Boolean))];

    // 2. Fetch existing projects
    const { data: existing, error: exErr } = await adminClient.from("projects").select("course_name");
    if (exErr) throw exErr;
    const existingNames = new Set((existing || []).map((p: any) => p.course_name));

    // 3. Insert new ones (skip duplicates)
    const newProjects = uniqueCourses
      .filter((name: string) => !existingNames.has(name))
      .map((name: string) => ({
        course_name: name,
        level: "Beginner" as string,
        weight: LEVEL_WEIGHTS["Beginner"],
      }));

    if (newProjects.length > 0) {
      await adminClient.from("projects").insert(newProjects);
    }

    // 4. Return all projects ordered by level then name
    const { data: projects, error: projErr } = await adminClient
      .from("projects")
      .select("*")
      .order("level")
      .order("course_name");

    if (projErr) throw projErr;

    return new Response(JSON.stringify(projects || []), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    const status = e.message === "Unauthorized" ? 401 : e.message === "Forbidden" ? 403 : 500;
    return new Response(JSON.stringify({ error: e.message }), { status, headers: corsHeaders });
  }
});
