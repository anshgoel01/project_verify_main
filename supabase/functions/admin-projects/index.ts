// @ts-nocheck
import { createClient } from "supabase";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const LEVEL_WEIGHTS: Record<string, number> = {
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

  // Use user_roles table (more reliable than rpc)
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
        .from("level_weights")
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

      // Fetch current weights to know old defaults
      const { data: oldWeights } = await supabase
        .from("level_weights")
        .select("level, weight");
      const oldMap: Record<string, number> = {};
      for (const row of oldWeights || []) {
        oldMap[row.level] = Number(row.weight);
      }

      // Upsert new weights and update projects that still use old default
      for (const [level, newWeight] of Object.entries(weights)) {
        const w = Number(newWeight);

        await supabase
          .from("level_weights")
          .upsert(
            { level, weight: w, updated_at: new Date().toISOString() },
            { onConflict: "level" }
          );

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
    // 1. Fetch all distinct coursera_course values from submissions
    const { data: submissions, error: subErr } = await supabase
      .from("submissions")
      .select("coursera_course, level")
      .not("coursera_course", "is", null)
      .neq("coursera_course", "");

    if (subErr) throw subErr;

    // Build a map of course_name → best level from submissions
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

    // 2. Fetch existing projects
    const { data: existing, error: exErr } = await supabase
      .from("projects")
      .select("course_name");
    if (exErr) throw exErr;
    const existingNames = new Set((existing || []).map((p: any) => p.course_name));

    // 3. Fetch current level weights from DB for new project insertion
    const { data: savedWeights } = await supabase
      .from("level_weights")
      .select("level, weight");
    const weightMap: Record<string, number> = { ...LEVEL_WEIGHTS };
    for (const row of savedWeights || []) {
      weightMap[row.level] = Number(row.weight);
    }

    // 4. Insert new projects with detected levels and saved weights
    const newProjects = uniqueCourses
      .filter((name: string) => !existingNames.has(name))
      .map((name: string) => {
        const level = courseLevelMap.get(name) || "Beginner";
        return {
          course_name: name,
          level,
          weight: weightMap[level] ?? LEVEL_WEIGHTS["Beginner"],
        };
      });

    if (newProjects.length > 0) {
      await supabase.from("projects").insert(newProjects);
    }

    // 5. Return all projects ordered by level then name
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

// import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// const corsHeaders = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Headers":
//     "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
// };


// const LEVEL_WEIGHTS: Record<string, number> = {
//   Beginner: 0.25,
//   Intermediate: 0.50,
//   Advanced: 0.75,
//   Mixed: 0.60,
// };

// async function getAdminClient(req: Request) {
//   const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
//   const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
//   const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

//   const authHeader = req.headers.get("Authorization");
//   console.log("Auth header present:", !!authHeader);
//   if (!authHeader) throw new Error("Unauthorized");

//   const token = authHeader.replace("Bearer ", "");
//   const userClient = createClient(supabaseUrl, anonKey, {
//     global: { headers: { Authorization: authHeader } },
//   });
//   const { data: { user }, error: userError } = await userClient.auth.getUser(token);
//   console.log("getUser result:", user?.id, "error:", userError?.message);
//   if (!user) throw new Error("Unauthorized");

//   const adminClient = createClient(supabaseUrl, serviceKey);
//   const { data: isAdmin, error: adminError } = await adminClient.rpc("is_admin", { _user_id: user.id });
//   console.log("isAdmin result:", isAdmin, "error:", adminError?.message);
//   if (!isAdmin) throw new Error("Forbidden");

//   return adminClient;
// }

// Deno.serve(async (req) => {
//   if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

//   try {
//     const adminClient = await getAdminClient(req);

//     if (req.method === "PUT") {
//       // Update a project's level and weight
//       const { id, level, weight } = await req.json();
//       if (!id) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers: corsHeaders });

//       const { error } = await adminClient.from("projects").update({ level, weight }).eq("id", id);
//       if (error) throw error;

//       return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
//     }

//     // GET: Sync unique projects from submissions then return all
//     // 1. Fetch all distinct coursera_course values from submissions
//     const { data: submissions, error: subErr } = await adminClient
//       .from("submissions")
//       .select("coursera_course, level")
//       .not("coursera_course", "is", null)
//       .neq("coursera_course", "");

//     if (subErr) throw subErr;

//     // Build a map of course_name → best level from submissions
//     const courseLevelMap = new Map<string, string>();
//     for (const s of (submissions || [])) {
//       const course = s.coursera_course?.trim();
//       if (!course) continue;
//       // Use the level from the submission if available, otherwise default to Beginner
//       const level = s.level || "Beginner";
//       // Keep the first non-Beginner level found, or the first level
//       if (!courseLevelMap.has(course) || (courseLevelMap.get(course) === "Beginner" && level !== "Beginner")) {
//         courseLevelMap.set(course, level);
//       }
//     }

//     const uniqueCourses = [...courseLevelMap.keys()];

//     // 2. Fetch existing projects
//     const { data: existing, error: exErr } = await adminClient.from("projects").select("course_name");
//     if (exErr) throw exErr;
//     const existingNames = new Set((existing || []).map((p: any) => p.course_name));

//     // 3. Insert new ones with detected levels
//     const newProjects = uniqueCourses
//       .filter((name: string) => !existingNames.has(name))
//       .map((name: string) => {
//         const level = courseLevelMap.get(name) || "Beginner";
//         return {
//           course_name: name,
//           level,
//           weight: LEVEL_WEIGHTS[level] || LEVEL_WEIGHTS["Beginner"],
//         };
//       });

//     if (newProjects.length > 0) {
//       await adminClient.from("projects").insert(newProjects);
//     }

//     // 4. Return all projects ordered by level then name
//     const { data: projects, error: projErr } = await adminClient
//       .from("projects")
//       .select("*")
//       .order("level")
//       .order("course_name");

//     if (projErr) throw projErr;

//     return new Response(JSON.stringify(projects || []), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
//   } catch (e: any) {
//     const status = e.message === "Unauthorized" ? 401 : e.message === "Forbidden" ? 403 : 500;
//     return new Response(JSON.stringify({ error: e.message }), { status, headers: corsHeaders });
//   }
// });

// import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// const corsHeaders = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
// };

// const LEVEL_WEIGHTS: Record<string, number> = {
//   Beginner: 0.25,
//   Intermediate: 0.50,
//   Advanced: 0.75,
//   Mixed: 0.60,
// };

// async function getAdminClient(req: Request) {
//   const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
//   const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
//   const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

//   const authHeader = req.headers.get("Authorization");
//   if (!authHeader) throw new Error("Unauthorized");

//   const userClient = createClient(supabaseUrl, anonKey, {
//     global: { headers: { Authorization: authHeader } },
//   });
//   const { data: { user } } = await userClient.auth.getUser();
//   if (!user) throw new Error("Unauthorized");

//   const adminClient = createClient(supabaseUrl, serviceKey);
//   const { data: isAdmin } = await adminClient.rpc("is_admin", { _user_id: user.id });
//   if (!isAdmin) throw new Error("Forbidden");

//   return adminClient;
// }

// Deno.serve(async (req) => {
//   if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

//   try {
//     const adminClient = await getAdminClient(req);

//     if (req.method === "PUT") {
//       // Update a project's level and weight
//       const { id, level, weight } = await req.json();
//       if (!id) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers: corsHeaders });

//       const { error } = await adminClient.from("projects").update({ level, weight }).eq("id", id);
//       if (error) throw error;

//       return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
//     }

//     // GET: Sync unique projects from submissions then return all
//     // 1. Fetch all distinct coursera_course values from submissions
//     const { data: submissions, error: subErr } = await adminClient
//       .from("submissions")
//       .select("coursera_course")
//       .not("coursera_course", "is", null)
//       .neq("coursera_course", "");

//     if (subErr) throw subErr;

//     const uniqueCourses = [...new Set((submissions || []).map((s: any) => s.coursera_course?.trim()).filter(Boolean))];

//     // 2. Fetch existing projects
//     const { data: existing, error: exErr } = await adminClient.from("projects").select("course_name");
//     if (exErr) throw exErr;
//     const existingNames = new Set((existing || []).map((p: any) => p.course_name));

//     // 3. Insert new ones (skip duplicates)
//     const newProjects = uniqueCourses
//       .filter((name: string) => !existingNames.has(name))
//       .map((name: string) => ({
//         course_name: name,
//         level: "Beginner" as string,
//         weight: LEVEL_WEIGHTS["Beginner"],
//       }));

//     if (newProjects.length > 0) {
//       await adminClient.from("projects").insert(newProjects);
//     }

//     // 4. Return all projects ordered by level then name
//     const { data: projects, error: projErr } = await adminClient
//       .from("projects")
//       .select("*")
//       .order("level")
//       .order("course_name");

//     if (projErr) throw projErr;

//     return new Response(JSON.stringify(projects || []), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
//   } catch (e: any) {
//     const status = e.message === "Unauthorized" ? 401 : e.message === "Forbidden" ? 403 : 500;
//     return new Response(JSON.stringify({ error: e.message }), { status, headers: corsHeaders });
//   }
// });
