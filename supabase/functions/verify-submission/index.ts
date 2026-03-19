// @ts-nocheck
import { createClient } from "supabase";

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
async function scrapeCoursera(url: string): Promise<{ name: string; course: string; level: string }> {
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
    let level = "Beginner";
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

    // Extract level from page content
    const levelPatterns = [
      /<meta[^>]+content=["']([^"']*(?:Beginner|Intermediate|Advanced|Mixed)[^"']*)["']/i,
      /(?:level[:\s]*|difficulty[:\s]*)(\b(?:Beginner|Intermediate|Advanced|Mixed)\b)/i,
      /(\b(?:Beginner|Intermediate|Advanced)\b)\s*(?:level|course)/i,
      /"level"\s*:\s*"(Beginner|Intermediate|Advanced|Mixed)"/i,
      /"difficultyLevel"\s*:\s*"(Beginner|Intermediate|Advanced|Mixed)"/i,
      /data-e2e="difficulty-level"[^>]*>([^<]+)</i,
      /class="[^"]*difficulty[^"]*"[^>]*>([^<]*(?:Beginner|Intermediate|Advanced|Mixed)[^<]*)</i,
    ];

    for (const pattern of levelPatterns) {
      const match = html.match(pattern);
      if (match) {
        const extracted = match[1].trim();
        if (/beginner/i.test(extracted)) level = "Beginner";
        else if (/intermediate/i.test(extracted)) level = "Intermediate";
        else if (/advanced/i.test(extracted)) level = "Advanced";
        else if (/mixed/i.test(extracted)) level = "Mixed";
        console.log("Found level via pattern:", pattern.source, "→", level);
        break;
      }
    }

    // Also check the URL path for level hints
    if (level === "Beginner") {
      const urlLower = finalUrl.toLowerCase();
      if (urlLower.includes("intermediate")) level = "Intermediate";
      else if (urlLower.includes("advanced")) level = "Advanced";
    }

    console.log("Extracted - name:", name || "(empty)", "course:", course || "(empty)", "level:", level);

    return { name, course, level };
  } catch (err) {
    console.error("Coursera scrape error:", err);
    return { name: "", course: "", level: "Beginner" };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Scrape a LinkedIn post page to extract the caption/text content.
 * LinkedIn often blocks full scraping, but og:description or meta tags
 * may contain the post text.
 */
async function scrapeLinkedInCaption(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      redirect: "follow",
    });
    const html = await r.text();
    console.log("LinkedIn page length:", html.length);

    // Strategy 1: og:description (most reliable for public posts)
    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    if (ogDescMatch) {
      const caption = ogDescMatch[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'");
      console.log("LinkedIn og:description:", caption.substring(0, 200));
      return caption;
    }

    // Strategy 2: twitter:description
    const twitterDescMatch = html.match(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:description["']/i);
    if (twitterDescMatch) {
      console.log("LinkedIn twitter:description found");
      return twitterDescMatch[1];
    }

    // Strategy 3: description meta tag
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    if (descMatch) {
      console.log("LinkedIn meta description found");
      return descMatch[1];
    }

    console.log("LinkedIn caption: could not extract from page");
    return "";
  } catch (err) {
    console.error("LinkedIn scrape error:", err);
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Check if a LinkedIn post caption mentions a course name.
 * Uses normalized fuzzy substring matching.
 */
function captionMentionsCourse(caption: string, courseName: string): boolean {
  if (!caption || !courseName) return false;
  const normCaption = normalizeText(caption);
  const normCourse = normalizeText(courseName);

  // Direct substring check
  if (normCaption.includes(normCourse)) return true;

  // Check individual significant words (3+ chars) from the course name
  const courseWords = normCourse.split(" ").filter(w => w.length >= 3);
  if (courseWords.length === 0) return false;

  const matchingWords = courseWords.filter(w => normCaption.includes(w));
  const matchRatio = matchingWords.length / courseWords.length;

  console.log(`Caption course match: ${matchingWords.length}/${courseWords.length} words (${(matchRatio * 100).toFixed(0)}%), threshold 60%`);
  return matchRatio >= 0.6;
}

function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), ms));
}

// const LEVEL_WEIGHTS: Record<string, number> = {
//   Beginner: 0.25,
//   Intermediate: 0.50,
//   Advanced: 0.75,
//   Mixed: 0.60,
// };
const { data: weightRows } = await supabase
  .from("default_weights")
  .select("level, weight");
const LEVEL_WEIGHTS: Record<string, number> = {
  Beginner: 0.25, Intermediate: 0.50, Advanced: 0.75, Mixed: 0.60
};
for (const row of weightRows || []) {
  LEVEL_WEIGHTS[row.level] = Number(row.weight);
}

async function verifySubmission(supabase: any, submission: any, userName: string): Promise<{
  coursera_name: string | null;
  linkedin_username: string | null;
  coursera_course: string | null;
  student_match: boolean;
  course_match: boolean;
  level: string;
  weight: number;
  status: string;
  error_message: string | null;
}> {
  // Scrape certificate link, project link, and LinkedIn caption in parallel
  const [certResult, projectResult, linkedinCaption] = await Promise.all([
    scrapeCoursera(submission.coursera_link),
    submission.project_link ? scrapeCoursera(submission.project_link) : Promise.resolve({ name: "", course: "", level: "Beginner" }),
    scrapeLinkedInCaption(submission.linkedin_link),
  ]);

  const { name: courseraName, course: courseraCourse } = certResult;
  const { course: projectCourse, level: detectedLevel } = projectResult;

  const linkedinUsername = extractLinkedInUsername(submission.linkedin_link);

  console.log("Verification data:", {
    userName,
    courseraName: courseraName || "(empty)",
    linkedinUsername: linkedinUsername || "(empty)",
    courseraCourse: courseraCourse || "(empty)",
    projectCourse: projectCourse || "(empty)",
    linkedinCaption: linkedinCaption ? linkedinCaption.substring(0, 100) + "..." : "(empty)",
    detectedLevel,
  });

  let studentMatch = false;
  let courseMatch = false;
  let errorMessage: string | null = null;

  // Check if LinkedIn username matches the student profile name
  const linkedinMatchesUser = linkedinUsername ? namesMatch(userName, linkedinUsername, 60) : false;

  // if (courseraName) {
  //   const courseraMatchesUser = namesMatch(userName, courseraName);
  //   const courseraMatchesLinkedin = linkedinUsername ? namesMatch(courseraName, linkedinUsername, 60) : false;
  //   studentMatch = courseraMatchesUser && (linkedinMatchesUser || courseraMatchesLinkedin);
  // } else {
  //   studentMatch = linkedinMatchesUser;
  //   console.log("Coursera name not found, falling back to LinkedIn match:", linkedinMatchesUser);
  // }
  if (!courseraName) {
    return {
      coursera_name: null,
      linkedin_username: linkedinUsername || null,
      coursera_course: courseraCourse || null,
      student_match: false,
      course_match: false,
      level: detectedLevel,
      weight: LEVEL_WEIGHTS[detectedLevel] || 0.25,
      status: "wrong",
      error_message: "Could not read your certificate. Please use the direct certificate link (coursera.org/account/accomplishments/verify/...) instead of a share link.",
    };
  }

  const courseraMatchesUser = namesMatch(userName, courseraName);
  const courseraMatchesLinkedin = linkedinUsername ? namesMatch(courseraName, linkedinUsername, 60) : false;
  studentMatch = courseraMatchesUser && (linkedinMatchesUser || courseraMatchesLinkedin);

  courseMatch = !!courseraCourse && courseraCourse.length > 3;

  // Cross-check: project course name must match certificate course name
  let projectNameMatch = true;
  if (courseraCourse && projectCourse && courseraCourse.length > 3 && projectCourse.length > 3) {
    projectNameMatch = namesMatch(courseraCourse, projectCourse, 50);
    console.log("Project-certificate course name match:", projectNameMatch,
      `cert="${courseraCourse}" project="${projectCourse}" ratio=${tokenSortRatio(courseraCourse, projectCourse).toFixed(1)}`);
    if (!projectNameMatch) {
      errorMessage = "Project name mismatch — make sure all three links refer to the same course.";
    }
  }

  // Check if LinkedIn post caption mentions the course name
  let linkedinCaptionMatch = true; // default true (fallback if caption unavailable)
  const courseNameToCheck = courseraCourse || projectCourse;
  if (linkedinCaption && courseNameToCheck && courseNameToCheck.length > 3) {
    linkedinCaptionMatch = captionMentionsCourse(linkedinCaption, courseNameToCheck);
    console.log("LinkedIn caption mentions course:", linkedinCaptionMatch);
    if (!linkedinCaptionMatch) {
      errorMessage = "LinkedIn post does not mention the submitted course — please share a post about this specific project.";
    }
  } else if (!linkedinCaption) {
    console.log("LinkedIn caption could not be fetched — falling back to name-only matching");
  }

  console.log("Match results:", { studentMatch, courseMatch, projectNameMatch, linkedinCaptionMatch, linkedinMatchesUser });

  const status = studentMatch && courseMatch && projectNameMatch && linkedinCaptionMatch ? "correct" : "wrong";
  if (status === "wrong" && !errorMessage) {
    if (!studentMatch) {
      errorMessage = "Name on certificate/LinkedIn does not match your profile.";
    } else if (!courseMatch) {
      errorMessage = "Could not verify the course from the certificate link.";
    }
  }

  return {
    coursera_name: courseraName || null,
    linkedin_username: linkedinUsername || null,
    coursera_course: courseraCourse || null,
    student_match: studentMatch,
    course_match: courseMatch,
    level: detectedLevel,
    weight: LEVEL_WEIGHTS[detectedLevel] || 0.25,
    status,
    error_message: errorMessage,
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
      }).eq("id", submission_id);

      console.log("Verification completed:", submission_id, "status:", result.status);

      return new Response(JSON.stringify({ status: result.status, error_message: result.error_message }), {
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
