import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizeText(text: string | null): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSortRatio(a: string, b: string): number {
  const tokensA = a.split(" ").sort().join(" ");
  const tokensB = b.split(" ").sort().join(" ");
  const maxLen = Math.max(tokensA.length, tokensB.length);
  if (maxLen === 0) return 100;
  const dist = levenshtein(tokensA, tokensB);
  return ((1 - dist / maxLen) * 100);
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function namesMatch(a: string, b: string, threshold = 80): boolean {
  if (!a || !b) return false;
  return tokenSortRatio(a, b) >= threshold;
}

/**
 * Extract LinkedIn profile username from various LinkedIn URL formats.
 * /in/anshuman-goel-a31756199 → "anshuman goel"
 * /posts/anshuman-goel-a31756199_hashtag-stuff → "anshuman goel"
 */
function extractLinkedInUsername(url: string): string {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split("/").filter(Boolean);

    // For /in/username-slug or /posts/username-slug_hashtags
    if (parts.length >= 2) {
      let slug = parts[1];

      // For /posts/ URLs, the format is username-id_hashtag-stuff
      // Split at underscore first to separate username from hashtags
      if (parts[0] === "posts") {
        slug = slug.split("_")[0];
      }

      // Remove trailing numeric ID (e.g., "anshuman-goel-a31756199" → "anshuman-goel")
      // LinkedIn profile slugs end with an alphanumeric ID
      const withoutId = slug.replace(/-[a-z0-9]{6,}$/i, "");
      if (withoutId) {
        return normalizeText(withoutId.replace(/-/g, " "));
      }
      return normalizeText(slug.replace(/-/g, " "));
    }
  } catch { /* ignore */ }
  return "";
}

/**
 * Scrape Coursera certificate/share page.
 * Tries multiple extraction strategies:
 * 1. "Completed by [Name]" pattern (works on direct certificate pages)
 * 2. og:title / og:description meta tags (may contain name on share pages)
 * 3. JSON-LD structured data
 */
async function scrapeCoursera(url: string): Promise<{ name: string; course: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    // First try following redirects to get the final page
    const r = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
      redirect: "follow",
    });
    const html = await r.text();
    const finalUrl = r.url; // The URL after redirects

    console.log("Coursera final URL:", finalUrl);
    console.log("HTML length:", html.length);

    let name = "";
    let course = "";

    // Strategy 1: "Completed by [Name]" pattern
    const completedByMatch = html.match(/Completed\s+by\s+([^<\n]+)/i);
    if (completedByMatch) {
      name = normalizeText(completedByMatch[1]);
      console.log("Found name via 'Completed by':", name);
    }

    // Strategy 2: og:description meta tag (Coursera often puts "Coursera certificate earned by [Name]")
    if (!name) {
      const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
      if (ogDescMatch) {
        const desc = ogDescMatch[1];
        console.log("og:description:", desc);
        // Look for patterns like "earned by Name" or "completed by Name"
        const earnedMatch = desc.match(/(?:earned|completed|awarded)\s+by\s+(.+?)(?:\.|,|$)/i);
        if (earnedMatch) {
          name = normalizeText(earnedMatch[1]);
          console.log("Found name via og:description:", name);
        }
      }
    }

    // Strategy 3: Look in JSON-LD or __NEXT_DATA__ for person name
    if (!name) {
      const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
      if (jsonLdMatch) {
        try {
          const jsonLd = JSON.parse(jsonLdMatch[1]);
          if (jsonLd.name) name = normalizeText(jsonLd.name);
          console.log("Found name via JSON-LD:", name);
        } catch { /* ignore parse errors */ }
      }
    }

    // Strategy 4: Look for data attributes or hidden spans with student name
    if (!name) {
      const namePatterns = [
        /data-e2e="full-name"[^>]*>([^<]+)</i,
        /class="[^"]*learner-name[^"]*"[^>]*>([^<]+)</i,
        /Verified\s+by\s+([^<\n]+)/i,
      ];
      for (const pattern of namePatterns) {
        const match = html.match(pattern);
        if (match) {
          name = normalizeText(match[1]);
          console.log("Found name via pattern:", pattern.source, "→", name);
          break;
        }
      }
    }

    // Extract course name
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const h2Match = html.match(/<h2[^>]*>([^<]+)<\/h2>/i);
    course = normalizeText(h2Match?.[1] || titleMatch?.[1] || "");

    console.log("Extracted - name:", name || "(empty)", "course:", course || "(empty)");

    return { name, course };
  } catch (err) {
    console.error("Coursera scrape error:", err);
    return { name: "", course: "" };
  } finally {
    clearTimeout(timeout);
  }
}

function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), ms));
}

async function verifySubmission(supabase: ReturnType<typeof createClient>, submission: any, userName: string): Promise<{
  coursera_name: string | null;
  linkedin_username: string | null;
  coursera_course: string | null;
  student_match: boolean;
  course_match: boolean;
  status: string;
}> {
  const { name: courseraName, course: courseraCourse } = await scrapeCoursera(submission.coursera_link);
  const linkedinUsername = extractLinkedInUsername(submission.linkedin_link);

  console.log("Verification data:", {
    userName,
    courseraName: courseraName || "(empty)",
    linkedinUsername: linkedinUsername || "(empty)",
    courseraCourse: courseraCourse || "(empty)",
  });

  let studentMatch = false;
  let courseMatch = false;

  // Check if LinkedIn username matches the student profile name
  const linkedinMatchesUser = linkedinUsername ? namesMatch(userName, linkedinUsername, 60) : false;

  if (courseraName) {
    // If we got a name from Coursera, verify it matches
    const courseraMatchesUser = namesMatch(userName, courseraName);
    const courseraMatchesLinkedin = linkedinUsername ? namesMatch(courseraName, linkedinUsername, 60) : false;
    studentMatch = courseraMatchesUser && (linkedinMatchesUser || courseraMatchesLinkedin);
  } else {
    // Coursera name couldn't be scraped (common with share links)
    // Fall back: if LinkedIn username matches student profile name, accept it
    studentMatch = linkedinMatchesUser;
    console.log("Coursera name not found, falling back to LinkedIn match:", linkedinMatchesUser);
  }

  courseMatch = !!courseraCourse && courseraCourse.length > 3;

  console.log("Match results:", { studentMatch, courseMatch, linkedinMatchesUser });

  const status = studentMatch && courseMatch ? "correct" : "wrong";

  return {
    coursera_name: courseraName || null,
    linkedin_username: linkedinUsername || null,
    coursera_course: courseraCourse || null,
    student_match: studentMatch,
    course_match: courseMatch,
    status,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let submission_id: string | undefined;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    submission_id = body.submission_id;

    if (!submission_id) {
      return new Response(JSON.stringify({ error: "submission_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Verification started:", submission_id);

    const { data: submission, error: fetchErr } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", submission_id)
      .single();

    if (fetchErr || !submission) {
      console.error("Submission not found:", submission_id, fetchErr);
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", submission.user_id)
      .single();

    const userName = normalizeText(profile?.full_name || "");
    console.log("User profile name:", userName);

    try {
      const result = await Promise.race([
        verifySubmission(supabase, submission, userName),
        timeoutPromise(12000),
      ]);

      await supabase.from("submissions").update({
        ...result,
        error_message: null,
      }).eq("id", submission_id);

      console.log("Verification completed:", submission_id, "status:", result.status);

      return new Response(JSON.stringify({ status: result.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (timeoutErr: any) {
      if (timeoutErr.message === "TIMEOUT") {
        console.log("Verification timed out:", submission_id);
        await supabase.from("submissions").update({
          status: "skipped",
          error_message: "Verification timed out",
        }).eq("id", submission_id);

        return new Response(JSON.stringify({ status: "skipped" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw timeoutErr;
    }
  } catch (err: any) {
    console.error("Verification failed:", submission_id, err);

    if (submission_id) {
      try {
        await supabase.from("submissions").update({
          status: "failed",
          error_message: err.message || "Verification failed",
        }).eq("id", submission_id);
      } catch (updateErr) {
        console.error("Failed to update submission status:", submission_id, updateErr);
      }
    }

    return new Response(JSON.stringify({ error: "Verification failed", status: "failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
