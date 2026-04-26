// @ts-nocheck
import { createClient } from "supabase";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { Ratelimit } from "npm:@upstash/ratelimit";
import { Redis } from "npm:@upstash/redis";

const weightsSchema = z.record(z.string(), z.number().min(0).max(10));
const putSchema = z.object({
  id: z.string().uuid(),
  level: z.string().min(1),
  weight: z.number().min(0).max(10),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("FRONTEND_URL") || "*",
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

  const { data: authData } = await userClient.auth.getUser();
  const user = authData?.user;
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
        const { success } = await ratelimit.limit(`ratelimit_projects_${ip}`);
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

    const result = await verifyAdmin(req);
    if (!result) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { supabase, user } = result;

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
      let body;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (!body.weights || typeof body.weights !== "object") {
        return new Response(JSON.stringify({ error: "Missing weights object" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const parsed = weightsSchema.safeParse(body.weights);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: "Invalid weights format", details: parsed.error }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const weights = parsed.data;

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

          await supabase
            .from("submissions")
            .update({ weight: w })
            .eq("level", level)
            .eq("weight", oldW);
        }
      }

      // Return success early after the primary DB update
      const successResponse = new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

      // Background logging
      try {
        await supabase.from("audit_logs").insert({
          admin_id: user.id,
          action: "UPDATE_DEFAULT_WEIGHTS",
          entity_name: "default_weights",
          details: weights,
        });
      } catch (logErr) {
        console.error("Audit log error (POST weights):", logErr);
      }

      return successResponse;
    }

    // ── PUT ── update a single project's level and weight
    if (req.method === "PUT") {
      let body;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const parsed = putSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: "Invalid payload format", details: parsed.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { id, level, weight } = parsed.data;

      const { data: projectData, error: projFetchErr } = await supabase
        .from("projects")
        .select("course_name")
        .eq("id", id)
        .single();
      if (projFetchErr) throw projFetchErr;

      const { error } = await supabase
        .from("projects")
        .update({ level, weight })
        .eq("id", id);
      if (error) throw error;

      if (projectData?.course_name) {
        const { error: subErr } = await supabase
          .from("submissions")
          .update({ level, weight })
          .eq("coursera_course", projectData.course_name);
        if (subErr) throw subErr;
      }

      try {
        await supabase.from("audit_logs").insert({
          admin_id: user.id,
          action: "UPDATE_PROJECT",
          entity_name: "projects",
          entity_id: id,
          details: { level, weight, course_name: projectData?.course_name },
        });
      } catch (logErr) {
        console.error("Audit log error (PUT project):", logErr);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sync = url.searchParams.get("sync");

    if (sync === "true") {
      // ── SYNC projects from submissions ──
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
    console.error("Admin projects error:", err);
    const status = err.message === "Forbidden" ? 403 : 500;
    const errorMsg = status === 500 ? "An internal error occurred." : err.message;
    return new Response(JSON.stringify({ error: errorMsg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
