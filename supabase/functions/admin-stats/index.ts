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
          limiter: Ratelimit.slidingWindow(10, "60 s"),
        });
        const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
        const { success } = await ratelimit.limit(`ratelimit_admin_${ip}`);
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

    // Fetch stats
    const [profilesRes, submissionsRes, collegesRes] = await Promise.all([
      adminClient.from("profiles").select("id", { count: "exact", head: true }),
      adminClient.from("submissions").select("status, level"),  // ✅ added level
      adminClient.from("profiles").select("college_id, score, correct_submissions, total_submissions, colleges(name)")
        .gt("total_submissions", 0),
    ]);

    const totalStudents = profilesRes.count || 0;
    const submissions = submissionsRes.data || [];
    const totalSubmissions = submissions.length;
    const correctCount = submissions.filter((s: any) => s.status === "correct").length;
    const wrongCount = submissions.filter((s: any) => s.status === "wrong").length;
    const processingCount = submissions.filter((s: any) => s.status === "processing").length;
    const skippedCount = submissions.filter((s: any) => s.status === "skipped" || s.status === "failed" || s.status === "error").length;

    // ✅ Level counts from correct submissions only
    const levelCounts: Record<string, number> = { Beginner: 0, Intermediate: 0, Advanced: 0, Mixed: 0 };
    for (const s of submissions.filter((s: any) => s.status === "correct")) {
      const lvl = s.level || "Beginner";
      if (lvl in levelCounts) levelCounts[lvl]++;
      else levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
    }

    // College-wise performance
    const collegeMap = new Map<string, { name: string; students: number; correct: number; total: number; score: number }>();
    for (const p of (collegesRes.data || []) as any[]) {
      const cName = p.colleges?.name || "Unknown";
      const cId = p.college_id;
      if (!collegeMap.has(cId)) {
        collegeMap.set(cId, { name: cName, students: 0, correct: 0, total: 0, score: 0 });
      }
      const c = collegeMap.get(cId)!;
      c.students++;
      c.correct += p.correct_submissions;
      c.total += p.total_submissions;
      c.score += p.score;
    }

    return new Response(JSON.stringify({
      totalStudents,
      totalSubmissions,
      correctCount,
      wrongCount,
      processingCount,
      skippedCount,
      levelCounts,           // ✅ added
      collegePerformance: Array.from(collegeMap.values()),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("Admin stats error:", e);
    return new Response(JSON.stringify({ error: "An internal server error occurred." }), { status: 500, headers: corsHeaders });
  }
});

// // @ts-nocheck
// import { createClient } from "supabase";

// const corsHeaders = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
// };

// Deno.serve(async (req: Request) => {
//   if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

//   try {
//     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
//     const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
//     const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

//     const authHeader = req.headers.get("Authorization");
//     if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

//     const userClient = createClient(supabaseUrl, anonKey, {
//       global: { headers: { Authorization: authHeader } },
//     });
//     const { data: { user } } = await userClient.auth.getUser();
//     if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

//     const adminClient = createClient(supabaseUrl, serviceKey);
//     const { data: isAdmin } = await adminClient.rpc("is_admin", { _user_id: user.id });
//     if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

//     // Fetch stats
//     const [profilesRes, submissionsRes, collegesRes] = await Promise.all([
//       adminClient.from("profiles").select("id", { count: "exact", head: true }),
//       adminClient.from("submissions").select("status"),
//       adminClient.from("profiles").select("college_id, score, correct_submissions, total_submissions, colleges(name)")
//         .gt("total_submissions", 0),
//     ]);

//     const totalStudents = profilesRes.count || 0;
//     const submissions = submissionsRes.data || [];
//     const totalSubmissions = submissions.length;
//     const correctCount = submissions.filter((s: any) => s.status === "correct").length;
//     const wrongCount = submissions.filter((s: any) => s.status === "wrong").length;
//     const processingCount = submissions.filter((s: any) => s.status === "processing").length;
//     const skippedCount = submissions.filter((s: any) => s.status === "skipped" || s.status === "failed").length;

//     // College-wise performance
//     const collegeMap = new Map<string, { name: string; students: number; correct: number; total: number; score: number }>();
//     for (const p of (collegesRes.data || []) as any[]) {
//       const cName = p.colleges?.name || "Unknown";
//       const cId = p.college_id;
//       if (!collegeMap.has(cId)) {
//         collegeMap.set(cId, { name: cName, students: 0, correct: 0, total: 0, score: 0 });
//       }
//       const c = collegeMap.get(cId)!;
//       c.students++;
//       c.correct += p.correct_submissions;
//       c.total += p.total_submissions;
//       c.score += p.score;
//     }

//     return new Response(JSON.stringify({
//       totalStudents,
//       totalSubmissions,
//       correctCount,
//       wrongCount,
//       processingCount,
//       skippedCount,
//       collegePerformance: Array.from(collegeMap.values()),
//     }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
//   } catch (e: any) {
//     return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
//   }
// });
