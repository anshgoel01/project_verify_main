// redeploy trigger
// @ts-nocheck
import { createClient } from "supabase";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const DEFAULT_WEIGHTS: Record<string, number> = {
  Beginner: 0.25,
  Intermediate: 0.50,
  Advanced: 0.75,
  Mixed: 0.60,
};

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) return null;
  return { user, supabase };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const result = await verifyAdmin(req);
    if (!result) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { supabase } = result;

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ── GET ?action=weights ── return level weights
    if (req.method === "GET" && action === "weights") {
      const { data, error } = await supabase
        .from("default_weights")
        .select("level, weight")
        .order("level");
      if (error) throw error;
      return new Response(JSON.stringify(data || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── POST ── bulk save weights + auto-update matching projects
    if (req.method === "POST") {
      const { weights } = await req.json();
      if (!weights || typeof weights !== "object") {
        return new Response(JSON.stringify({ error: "Missing weights object" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: oldWeights } = await supabase
        .from("default_weights")
        .select("level, weight");
      const oldMap: Record<string, number> = {};
      for (const row of oldWeights || []) {
        oldMap[row.level] = Number(row.weight);
      }

      for (const [level, newWeight] of Object.entries(weights)) {
        const w = Number(newWeight);

        const { error: upsertErr } = await supabase
          .from("default_weights")
          .upsert(
            { level, weight: w, updated_at: new Date().toISOString() },
            { onConflict: "level" }
          );
        if (upsertErr) throw upsertErr;

        const oldW = oldMap[level];
        if (oldW !== undefined && Math.abs(oldW - w) > 0.001) {
          await supabase
            .from("projects")
            .update({ weight: w })
            .eq("level", level)
            .eq("weight", oldW);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── PUT ── update a single project's level and weight
    if (req.method === "PUT") {
      const { id, level, weight } = await req.json();
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase
        .from("projects")
        .update({ level, weight })
        .eq("id", id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── GET ── sync projects from submissions then return all
    const { data: submissions, error: subErr } = await supabase
      .from("submissions")
      .select("coursera_course, level")
      .not("coursera_course", "is", null)
      .neq("coursera_course", "");
    if (subErr) throw subErr;

    const courseLevelMap = new Map<string, string>();
    for (const s of (submissions || [])) {
      const course = s.coursera_course?.trim();
      if (!course) continue;
      const level = s.level || "Beginner";
      if (!courseLevelMap.has(course) || (courseLevelMap.get(course) === "Beginner" && level !== "Beginner")) {
        courseLevelMap.set(course, level);
      }
    }

    const uniqueCourses = [...courseLevelMap.keys()];

    const { data: existing, error: exErr } = await supabase
      .from("projects")
      .select("course_name");
    if (exErr) throw exErr;
    const existingNames = new Set((existing || []).map((p: any) => p.course_name));

    const { data: savedWeights } = await supabase
      .from("default_weights")
      .select("level, weight");
    const weightMap: Record<string, number> = { ...DEFAULT_WEIGHTS };
    for (const row of savedWeights || []) {
      weightMap[row.level] = Number(row.weight);
    }

    const newProjects = uniqueCourses
      .filter((name: string) => !existingNames.has(name))
      .map((name: string) => {
        const level = courseLevelMap.get(name) || "Beginner";
        return {
          course_name: name,
          level,
          weight: weightMap[level] ?? DEFAULT_WEIGHTS["Beginner"],
        };
      });

    if (newProjects.length > 0) {
      await supabase.from("projects").insert(newProjects);
    }

    const { data: projects, error: projErr } = await supabase
      .from("projects")
      .select("id, course_name, level, weight")
      .order("level")
      .order("course_name");
    if (projErr) throw projErr;

    return new Response(JSON.stringify(projects || []), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
