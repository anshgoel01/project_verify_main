// @ts-nocheck
import { createClient } from "supabase";
import { Ratelimit } from "npm:@upstash/ratelimit";
import { Redis } from "npm:@upstash/redis";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("FRONTEND_URL") || "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizeText(text: string | null): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[-_.\s]+/g, " ")  // treat hyphens, underscores, dots as word separators
    .replace(/[^a-z\s]/g, "")   // strip any remaining non-alpha characters
    .replace(/\s+/g, " ")
    .trim();
}

// ✅ FIXED: word-based matching + compact fallback for LinkedIn slugs
function namesMatch(a: string, b: string, threshold = 80): boolean {
  if (!a || !b) return false;

  const normA = normalizeText(a);
  const normB = normalizeText(b);

  // Fast-path: compare with all spaces removed.
  // Handles LinkedIn slugs like "palakmahajan" matching profile name "palak mahajan".
  const compactA = normA.replace(/\s+/g, "");
  const compactB = normB.replace(/\s+/g, "");
  if (compactA && compactB && compactA === compactB) {
    console.log(`namesMatch: compact match "${compactA}" === "${compactB}"`);
    return true;
  }

  // Word-based scoring
  const wordsA = normA.split(" ").filter(Boolean).sort();
  const wordsB = normB.split(" ").filter(Boolean).sort();

  if (wordsA.length === 0 || wordsB.length === 0) return false;

  const setB = new Set(wordsB);
  const matchingWords = wordsA.filter(w => setB.has(w)).length;
  const totalUniqueWords = new Set([...wordsA, ...wordsB]).size;

  const score = (matchingWords / totalUniqueWords) * 100;
  console.log(`namesMatch checked: ${matchingWords}/${totalUniqueWords} words = ${score.toFixed(1)}%`);

  return score >= threshold;
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

    if (parts.length >= 2) {
      let slug = parts[1];

      if (parts[0] === "posts") {
        slug = slug.split("_")[0];
      }

      // Remove trailing alphanumeric ID (e.g., "anshuman-goel-a31756199" → "anshuman-goel")
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
 * Extract the raw slug from a LinkedIn profile URL (/in/ segment).
 * Used as the canonical stored identity to compare against post URLs.
 * linkedin.com/in/palak-mahajan → "palak-mahajan"
 * linkedin.com/in/palakmahajan → "palakmahajan"
 */
function extractProfileSlug(url: string): string {
  try {
    const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
    const parts = urlObj.pathname.split("/").filter(Boolean);
    if (parts[0] === "in" && parts[1]) {
      // Normalize: lowercase, strip trailing slash, remove trailing numeric IDs
      return normalizeText(parts[1].replace(/-[a-z0-9]{6,}$/i, "").replace(/-/g, " "));
    }
  } catch { /* ignore */ }
  return "";
}

/**
 * Scrape Coursera certificate/share page.
 * Tries multiple extraction strategies in order:
 * 1. "Completed by [Name]" pattern
 * 2. og:description meta tag
 * 3. JSON-LD structured data
 * 4. DOM attribute patterns
 */
async function scrapeCoursera(url: string): Promise<{ name: string; course: string; level: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
      redirect: "follow",
    });
    const html = await r.text();
    const finalUrl = r.url;

    console.log("Coursera final URL:", finalUrl);
    console.log("HTML length:", html.length);

    let name = "";
    let course = "";
    let level = "Beginner";

    // Strategy 1: "Completed by [Name]" pattern
    // const completedByMatch = html.match(/Completed\s+by\s+([^<\n]+)/i);
    // if (completedByMatch) {
    //   name = normalizeText(completedByMatch[1]);
    //   console.log("Found name via 'Completed by':", name);
    // }

    // // Strategy 2: og:description meta tag
    // if (!name) {
    //   const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    //     || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    //   if (ogDescMatch) {
    //     const desc = ogDescMatch[1];
    //     console.log("og:description:", desc);
    //     const earnedMatch = desc.match(/(?:earned|completed|awarded)\s+by\s+(.+?)(?:\.|,|$)/i);
    //     if (earnedMatch) {
    //       name = normalizeText(earnedMatch[1]);
    //       console.log("Found name via og:description:", name);
    //     }
    //   }
    // }

    // Strategy 3: JSON-LD structured data
    // if (!name) {
    //   const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    //   if (jsonLdMatch) {
    //     try {
    //       const jsonLd = JSON.parse(jsonLdMatch[1]);
    //       if (jsonLd.name) {
    //         name = normalizeText(jsonLd.name);
    //         console.log("Found name via JSON-LD:", name);
    //       }
    //     } catch { /* ignore parse errors */ }
    //   }
    // }

    // Strategy 1.5: Extract from certificate image ALT text
    if (!name) {
      const altMatch = html.match(/alt="View certificate for ([^,]+),/i);
      if (altMatch) {
        name = normalizeText(altMatch[1]);
        console.log("Found name via image ALT");
      }
    }

    // Strategy 4: DOM attribute patterns
    // if (!name) {
    //   const namePatterns = [
    //     /data-e2e="full-name"[^>]*>([^<]+)</i,
    //     /class="[^"]*learner-name[^"]*"[^>]*>([^<]+)</i,
    //     /Verified\s+by\s+([^<\n]+)/i,
    //   ];
    //   for (const pattern of namePatterns) {
    //     const match = html.match(pattern);
    //     if (match) {
    //       name = normalizeText(match[1]);
    //       console.log("Found name via pattern:", pattern.source, "→", name);
    //       break;
    //     }
    //   }
    // }

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

    console.log("Extracted profile securely.");
    return { name, course, level };
  } catch (err) {
    console.error("Coursera scrape error:", err);
    return { name: "", course: "", level: "Beginner" };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Extract post ID from various LinkedIn URL formats.
 * Supports /posts/..., /feed/update/urn:li:activity:..., /feed/update/urn:li:share:...
 */
function extractLinkedInPostId(url: string): string | null {
  try {
    // Format 1: activity ID in URL (most common)
    // e.g. /posts/username_activity-7307031929383186432-xxxx
    const activityMatch = url.match(/activity[:-](\d{10,})/i);
    if (activityMatch) return activityMatch[1];

    // Format 2: urn:li:activity:POSTID
    const urnActivityMatch = url.match(/urn:li:activity:(\d+)/i);
    if (urnActivityMatch) return urnActivityMatch[1];

    // Format 3: urn:li:share:POSTID
    const urnShareMatch = url.match(/urn:li:share:(\d+)/i);
    if (urnShareMatch) return urnShareMatch[1];

    // Format 4: /posts/name_POSTID-xxxx
    const postSlugMatch = url.match(/\/posts\/[^/]*_(\d{10,})/);
    if (postSlugMatch) return postSlugMatch[1];
  } catch { /* ignore */ }
  return null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Scrape LinkedIn post caption.
 * Strategy 1: Use the embed URL (linkedin.com/embed/feed/update/urn:li:activity:ID)
 *   — returns server-rendered HTML with full post text, no JS needed.
 * Strategy 2: Fall back to og:description from the regular page (truncated but better than nothing).
 */
async function scrapeLinkedInCaption(url: string): Promise<string> {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  // ── Strategy 1: Embed URL (full caption, server-rendered) ──
  const postId = extractLinkedInPostId(url);
  if (postId) {
    const embedUrl = `https://www.linkedin.com/embed/feed/update/urn:li:activity:${postId}`;
    console.log("Trying LinkedIn embed URL:", embedUrl);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const r = await fetch(embedUrl, { signal: controller.signal, headers, redirect: "follow" });
        const html = await r.text();
        console.log("LinkedIn embed page length:", html.length);

        // Embed page contains post text in <p> tags or a div with class containing "share-content"
        // Try multiple patterns to extract the caption text
        const captionPatterns = [
          /<div[^>]+class="[^"]*share-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          /<div[^>]+class="[^"]*feed-shared-text[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          /<p[^>]+class="[^"]*break-words[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
          /<div[^>]+class="[^"]*commentary[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          // Generic: grab all visible text from <p> tags in the body
          /<p[^>]*>([\s\S]{20,500}?)<\/p>/i,
        ];

        for (const pattern of captionPatterns) {
          const match = html.match(pattern);
          if (match) {
            // Strip inner HTML tags and decode entities
            const text = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
            if (text.length > 20) {
              console.log("LinkedIn embed caption found. Length:", text.length);
              return text;
            }
          }
        }

        // Fallback: try og:description from embed page
        const ogMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
        if (ogMatch) {
          const caption = decodeHtmlEntities(ogMatch[1]);
          console.log("LinkedIn embed og:description found. Length:", caption.length);
          return caption;
        }

        console.log("LinkedIn embed: no caption patterns matched");
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      console.error("LinkedIn embed scrape error:", err);
    }
  } else {
    console.log("Could not extract post ID from LinkedIn URL:", url);
  }

  // ── Strategy 2: Regular page og:description (truncated fallback) ──
  console.log("Falling back to regular LinkedIn page scrape");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, { signal: controller.signal, headers, redirect: "follow" });
    const html = await r.text();
    console.log("LinkedIn regular page length:", html.length);

    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    if (ogDescMatch) {
      const caption = decodeHtmlEntities(ogDescMatch[1]);
      console.log("LinkedIn regular og:description found. Length:", caption.length);
      return caption;
    }

    const twitterMatch = html.match(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:description["']/i);
    if (twitterMatch) return decodeHtmlEntities(twitterMatch[1]);

    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    if (descMatch) return decodeHtmlEntities(descMatch[1]);

    console.log("LinkedIn caption: could not extract from any source");
    return "";
  } catch (err) {
    console.error("LinkedIn regular scrape error:", err);
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Check if a LinkedIn post caption mentions a course name.
 */
function captionMentionsCourse(caption: string, courseName: string): boolean {
  if (!caption || !courseName) return false;
  const normCaption = normalizeText(caption);
  const normCourse = normalizeText(courseName);

  if (normCaption.includes(normCourse)) return true;

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

async function verifySubmission(supabase: any, submission: any, userName: string, storedLinkedinSlug: string | null): Promise<{
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
  // ✅ FIXED: fetch weights from DB inside the function where supabase is available
  const { data: weightRows } = await supabase
    .from("default_weights")
    .select("level, weight");
  const LEVEL_WEIGHTS: Record<string, number> = {
    Beginner: 0.25, Intermediate: 0.50, Advanced: 0.75, Mixed: 0.60,
  };
  for (const row of weightRows || []) {
    LEVEL_WEIGHTS[row.level] = Number(row.weight);
  }
  console.log("Loaded weights from DB:", JSON.stringify(LEVEL_WEIGHTS));

  // Scrape certificate link, project link, and LinkedIn caption in parallel
  const [certResult, projectResult, linkedinCaption] = await Promise.all([
    scrapeCoursera(submission.coursera_link),
    submission.project_link
      ? scrapeCoursera(submission.project_link)
      : Promise.resolve({ name: "", course: "", level: "Beginner" }),
    scrapeLinkedInCaption(submission.linkedin_link),
  ]);

  const { name: courseraName, course: courseraCourse } = certResult;
  const { course: projectCourse, level: detectedLevel } = projectResult;
  // Slug extracted from the submitted LinkedIn post URL (used throughout)
  const postLinkedinSlug = extractLinkedInUsername(submission.linkedin_link);

  console.log(`Verification started for user: ${userName}`);
  console.log(`Stored LinkedIn slug: "${storedLinkedinSlug}"`);
  console.log(`Post LinkedIn slug: "${postLinkedinSlug}"`);

  let studentMatch = false;
  let courseMatch = false;
  let errorMessage: string | null = null;

  // Check 1 — LinkedIn slug match
  let check1 = false;
  let check1Error: string | null = null;
  if (!storedLinkedinSlug) {
    check1Error = "No LinkedIn profile URL found on your account. Please update your profile.";
  } else {
    check1 = namesMatch(storedLinkedinSlug, postLinkedinSlug, 80);
    if (!check1) {
      check1Error = "LinkedIn post URL does not match your LinkedIn profile.";
    }
  }
  const linkedinMatchesUser = check1;

  // ✅ FIXED: if certificate name can't be read, don't auto-fail —
  // fall back to LinkedIn-only match so legitimate students aren't rejected
  if (!courseraName) {
    console.log("Certificate name not found, falling back to LinkedIn-only match:", linkedinMatchesUser);
    if (linkedinMatchesUser) {
      // LinkedIn checks out but we couldn't read the certificate name
      // Mark as wrong with a clear message asking for a better link
      return {
        coursera_name: null,
        linkedin_username: postLinkedinSlug || null,
        coursera_course: courseraCourse || null,
        student_match: false,
        course_match: false,
        level: detectedLevel,
        weight: LEVEL_WEIGHTS[detectedLevel] || 0.25,
        status: "wrong",
        error_message: "Could not read your certificate. Please use the direct certificate link (coursera.org/account/accomplishments/verify/...) instead of a share link.",
      };
    }
    return {
      coursera_name: null,
      linkedin_username: postLinkedinSlug || null,
      coursera_course: courseraCourse || null,
      student_match: false,
      course_match: false,
      level: detectedLevel,
      weight: LEVEL_WEIGHTS[detectedLevel] || 0.25,
      status: "wrong",
      error_message: "Could not read your certificate. Please use the direct certificate link (coursera.org/account/accomplishments/verify/...) instead of a share link.",
    };
  }

  // ✅ FIXED: namesMatch now uses word-based matching — "anshuman goel" vs "aastha garg" = 0% → rejected
  // Check 2 — Certificate name vs signup name
  const courseraMatchesUser = namesMatch(userName, courseraName);
  const check2 = courseraMatchesUser;
  // const courseraMatchesLinkedin = postLinkedinSlug ? namesMatch(courseraName, postLinkedinSlug, 60) : false;

  console.log("Check1 LinkedIn match:", check1);
  console.log("Check2 Certificate match:", check2);
  console.log("courseraMatchesUser:", courseraMatchesUser, "linkedinMatchesUser:", linkedinMatchesUser);

  // studentMatch = Check 1 AND Check 2
  studentMatch = check1 && check2;

  // courseMatch: certificate must show a readable course name
  courseMatch = !!courseraCourse && courseraCourse.length > 3;

  // Cross-check: project course name MUST match certificate course name.
  // If we have a project_link but can't scrape a course name from it,
  // that is still a mismatch — don't silently pass.
  let projectNameMatch = true;
  if (submission.project_link) {
    if (!projectCourse || projectCourse.length <= 3) {
      // Couldn't read the project page — can't verify the match
      projectNameMatch = false;
      errorMessage = "Could not read the project page — please use the direct Coursera project link (coursera.org/projects/...).";
    } else if (courseraCourse && courseraCourse.length > 3) {
      projectNameMatch = namesMatch(courseraCourse, projectCourse, 50);
      console.log("Project-certificate course name match:", projectNameMatch);
      if (!projectNameMatch) {
        errorMessage = "Project name mismatch — make sure all three links refer to the same course.";
      }
    }
  }

  // Check if LinkedIn post caption mentions the course name
  // This is a mandatory check — if we can't get the caption, send for manual admin review
  let linkedinCaptionMatch = true;
  const courseNameToCheck = courseraCourse || projectCourse;
  if (!linkedinCaption || linkedinCaption.length <= 30) {
    // Could not scrape LinkedIn caption — can't auto-verify, needs manual review
    console.log("LinkedIn caption unavailable or too short — flagging for manual review");
    return {
      coursera_name: courseraName || null,
      linkedin_username: postLinkedinSlug || null,
      coursera_course: courseraCourse || null,
      student_match: studentMatch,
      course_match: courseMatch,
      level: detectedLevel,
      weight: LEVEL_WEIGHTS[detectedLevel] || 0.25,
      status: "skipped",
      error_message: "Could not verify your LinkedIn post — please make sure your post is public and mentions the course name in the first line.",
    };
  }
  if (courseNameToCheck && courseNameToCheck.length > 3) {
    linkedinCaptionMatch = captionMentionsCourse(linkedinCaption, courseNameToCheck);
    console.log("LinkedIn caption mentions course:", linkedinCaptionMatch, "(caption length:", linkedinCaption.length, ")");
    if (!linkedinCaptionMatch) {
      errorMessage = "LinkedIn post does not mention the submitted course — please share a post about this specific project.";
    }
  }

  console.log("Match results:", { studentMatch, courseMatch, projectNameMatch, linkedinCaptionMatch, linkedinMatchesUser });

  const status = studentMatch && courseMatch && projectNameMatch && linkedinCaptionMatch ? "correct" : "wrong";
  if (status === "wrong" && !errorMessage) {
    if (!studentMatch) {
      errorMessage = !check1 ? check1Error : "Name on certificate does not match your account name.";
    } else if (!courseMatch) {
      errorMessage = "Could not verify the course from the certificate link.";
    }
  }

  return {
    coursera_name: courseraName || null,
    linkedin_username: postLinkedinSlug || null,
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

  // Rate Limiting
  try {
    const upstashUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
    const upstashToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
    if (upstashUrl && upstashToken) {
      const redis = new Redis({ url: upstashUrl, token: upstashToken });
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "60 s"),
      });
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
      const { success } = await ratelimit.limit(`ratelimit_${ip}`);
      if (!success) {
        return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
  } catch (rateLimitErr) {
    console.error("Rate limit check failed", rateLimitErr);
    // fail open if redis is down
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
      .select("full_name, linkedin_url")
      .eq("user_id", submission.user_id)
      .single();

    const userName = normalizeText(profile?.full_name || "");

    // Extract stored LinkedIn profile slug (ground-truth identity)
    const storedLinkedinUrl: string | null = profile?.linkedin_url || null;
    const storedLinkedinSlug = storedLinkedinUrl ? extractProfileSlug(storedLinkedinUrl) : null;

    console.log(`User profile loaded. Stored LinkedIn slug: "${storedLinkedinSlug || "(none)"}"`);

    if (!storedLinkedinSlug) {
      console.log("Blocking verification: No LinkedIn profile URL found on user account.");
      const error_message = "No LinkedIn profile URL found on your account. Please update your profile with your LinkedIn profile link before submitting.";
      await supabase.from("submissions").update({ status: "wrong", error_message }).eq("id", submission_id).eq("status", "processing");
      return new Response(JSON.stringify({
        status: "wrong",
        error_message
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const result = await Promise.race([
        verifySubmission(supabase, submission, userName, storedLinkedinSlug),
        timeoutPromise(12000),
      ]);

      if (result.status === "correct") {
        // Only persist the submission when it's verified correct
        await supabase.from("submissions").update({ ...result }).eq("id", submission_id).eq("status", "processing");
        console.log("Verification passed — submission saved:", submission_id);
      } else {
        // Always update failed/wrong/skipped submissions — store them for debugging
        await supabase.from("submissions").update({ ...result }).eq("id", submission_id).eq("status", "processing");
        console.log("Verification failed — submission updated:", submission_id, "status:", result.status);
      }

      console.log("Verification completed:", submission_id, "status:", result.status);

      return new Response(JSON.stringify({ status: result.status, error_message: result.error_message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (timeoutErr: any) {
      if (timeoutErr.message === "TIMEOUT") {
        console.log("Verification timed out — marking submission as skipped:", submission_id);
        // Mark as skipped on timeout — don't delete them
        await supabase.from("submissions").update({ status: "skipped", error_message: "Verification timed out. Please try again." }).eq("id", submission_id).eq("status", "processing");

        return new Response(JSON.stringify({ status: "skipped", error_message: "Verification timed out. Please try again." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw timeoutErr;
    }
  } catch (err: any) {
    console.error("Verification failed:", submission_id, err);

    if (submission_id) {
      try {
        // Update on internal error — don't delete
        await supabase.from("submissions").update({ status: "error", error_message: "An internal error occurred. Please try again." }).eq("id", submission_id).eq("status", "processing");
      } catch (updateErr) {
        console.error("Failed to update submission after error:", submission_id, updateErr);
      }
    }

    return new Response(JSON.stringify({ error: "Verification failed internally.", status: "failed", error_message: "An internal error occurred. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});