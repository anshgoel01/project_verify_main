// @ts-nocheck
import { createClient } from "supabase";
import { Ratelimit } from "npm:@upstash/ratelimit";
import { Redis } from "npm:@upstash/redis";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("FRONTEND_URL") || "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_WEIGHTS: Record<string, number> = {
  Beginner: 0.25,
  Intermediate: 0.50,
  Advanced: 0.75,
  Mixed: 0.60,
};

/* ── Percentile-band definitions ── */
const BANDS = [
  { minPercentile: 0.90, bandMin: 7.0, bandMax: 8.0 },
  { minPercentile: 0.75, bandMin: 6.0, bandMax: 7.0 },
  { minPercentile: 0.50, bandMin: 5.0, bandMax: 6.0 },
  { minPercentile: 0.30, bandMin: 4.0, bandMax: 5.0 },
  { minPercentile: 0.15, bandMin: 3.0, bandMax: 4.0 },
  { minPercentile: 0.05, bandMin: 2.0, bandMax: 3.0 },
  { minPercentile: 0.00, bandMin: 1.0, bandMax: 2.0 },
];

/* ── SpreadsheetML XML builder ── */
function generateExcelXML(
  headers: string[],
  rows: { cells: (string | number | "")[]; bold?: boolean }[]
) {
  const esc = (v: any) =>
    String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const headerCells = headers
    .map((h) => `<Cell><Data ss:Type="String">${esc(h)}</Data></Cell>`)
    .join("");

  const dataRows = rows
    .map((r) => {
      const cells = r.cells.map((c) => {
        if (c === "") return `<Cell><Data ss:Type="String"></Data></Cell>`;
        const type = typeof c === "number" ? "Number" : "String";
        return `<Cell><Data ss:Type="${type}">${esc(c)}</Data></Cell>`;
      });
      const style = r.bold ? ` ss:StyleID="Header"` : "";
      return `<Row${style}>${cells.join("")}</Row>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header"><Font ss:Bold="1"/></Style>
 </Styles>
 <Worksheet ss:Name="Sheet1">
  <Table>
   <Row ss:StyleID="Header">${headerCells}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;
}

/* ── Marks calculation ── */
function computeMarks(
  studentScores: { userId: string; rawScore: number }[]
): Map<string, number> {
  const result = new Map<string, number>();

  // Students with rawScore == 0 get marks = 0
  for (const s of studentScores) {
    if (s.rawScore <= 0) result.set(s.userId, 0);
  }

  // Only rank students with rawScore > 0
  const eligible = studentScores.filter((s) => s.rawScore > 0);
  const n = eligible.length;
  if (n === 0) return result;

  // Sort ascending by rawScore for percentile ranking
  const sorted = [...eligible].sort((a, b) => a.rawScore - b.rawScore);

  // Pre-compute band assignment for each index
  const bandAssign: typeof BANDS[number][] = [];
  for (let i = 0; i < n; i++) {
    const percentile = i / n;
    let band = BANDS[BANDS.length - 1];
    for (const b of BANDS) {
      if (percentile >= b.minPercentile) { band = b; break; }
    }
    bandAssign.push(band);
  }

  // Collect min/max rawScore per band
  const bandScoreRange = new Map<number, { min: number; max: number }>();
  for (let i = 0; i < n; i++) {
    const bMin = bandAssign[i].bandMin;
    const score = sorted[i].rawScore;
    const existing = bandScoreRange.get(bMin);
    if (!existing) {
      bandScoreRange.set(bMin, { min: score, max: score });
    } else {
      existing.min = Math.min(existing.min, score);
      existing.max = Math.max(existing.max, score);
    }
  }

  for (let i = 0; i < n; i++) {
    const student = sorted[i];
    const band = bandAssign[i];
    const range = bandScoreRange.get(band.bandMin)!;

    let marks: number;
    if (range.max === range.min) {
      marks = band.bandMin;
    } else {
      marks =
        band.bandMin +
        ((student.rawScore - range.min) / (range.max - range.min)) * 1.0;
    }

    marks = Math.min(8.0, Math.round(marks * 100) / 100);
    result.set(student.userId, marks);
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

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
          limiter: Ratelimit.slidingWindow(3, "60 s"),
        });
        const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
        const { success } = await ratelimit.limit(`ratelimit_export_${ip}`);
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

    /* ── Auth ── */
    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } =
      await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    const userId = claimsData.claims.sub;

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await adminClient.rpc("is_admin", {
      _user_id: userId,
    });
    if (!isAdmin)
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: corsHeaders,
      });

    /* ── Parse params ── */
    const url = new URL(req.url);
    const collegeId = url.searchParams.get("college_id");
    const columnsParam = url.searchParams.get("columns") || "";
    const selectedCols = new Set(columnsParam.split(",").filter(Boolean));

    const wantLinks =
      selectedCols.has("coursera_link") || selectedCols.has("linkedin_link");
    const wantMarks = selectedCols.has("marks");
    const wantLevelCounts =
      selectedCols.has("beginner_submissions") ||
      selectedCols.has("intermediate_submissions") ||
      selectedCols.has("advanced_submissions") ||
      selectedCols.has("mixed_submissions");
    const wantTotalSubs = selectedCols.has("total_submissions");

    /* ── Fetch level weights ── */
    const { data: weightRows } = await adminClient
      .from("default_weights")
      .select("level, weight");
    const weightMap: Record<string, number> = { ...DEFAULT_WEIGHTS };
    for (const row of weightRows || []) {
      weightMap[row.level] = Number(row.weight);
    }

    /* ── Fetch profiles ── */
    let profileQuery = adminClient
      .from("profiles")
      .select("user_id, full_name, roll_no, total_submissions, college_id");
    if (collegeId && collegeId !== "all")
      profileQuery = profileQuery.eq("college_id", collegeId);
    const { data: profiles, error: profileError } = await profileQuery.order(
      "full_name",
      { ascending: true }
    );
    if (profileError) throw profileError;

    /* ── Fetch correct submissions ── */
    let subQuery = adminClient
      .from("submissions")
      .select("user_id, coursera_link, linkedin_link, level")
      .eq("status", "correct");
    if (collegeId && collegeId !== "all")
      subQuery = subQuery.eq("college_id", collegeId);
    const { data: subs } = await subQuery;

    const submissionsByUser = new Map<string, any[]>();
    for (const s of subs || []) {
      if (!submissionsByUser.has(s.user_id))
        submissionsByUser.set(s.user_id, []);
      submissionsByUser.get(s.user_id)!.push(s);
    }

    /* ── Compute marks (always, so we have them if needed) ── */
    const studentScores = (profiles || []).map((p: any) => {
      const userSubs = submissionsByUser.get(p.user_id) || [];
      const rawScore = userSubs.reduce(
        (acc: number, s: any) =>
          acc + (weightMap[s.level || "Beginner"] ?? DEFAULT_WEIGHTS.Beginner),
        0
      );
      return { userId: p.user_id, rawScore };
    });
    const marksMap = computeMarks(studentScores);

    /* ── Build column definitions (order matters) ── */
    const colDefs: { key: string; header: string }[] = [
      { key: "coursera_link", header: "Coursera Link" },
      { key: "linkedin_link", header: "LinkedIn Link" },
      { key: "marks", header: "Marks (out of 8)" },
      { key: "total_submissions", header: "Total Submissions" },
      { key: "beginner_submissions", header: "Beginner Submissions" },
      { key: "intermediate_submissions", header: "Intermediate Submissions" },
      { key: "advanced_submissions", header: "Advanced Submissions" },
      { key: "mixed_submissions", header: "Mixed Submissions" },
    ];

    const headers: string[] = ["Student Name", "Roll No"];
    const columnOrder: string[] = [];
    for (const col of colDefs) {
      if (selectedCols.has(col.key)) {
        headers.push(col.header);
        columnOrder.push(col.key);
      }
    }

    /* ── Find index of key columns in columnOrder to place values correctly ── */
    const courseraIdx = columnOrder.indexOf("coursera_link");
    const linkedinIdx = columnOrder.indexOf("linkedin_link");
    const marksIdx = columnOrder.indexOf("marks");

    /* ── Build rows ── */
    const rows: { cells: (string | number | "")[]; bold?: boolean }[] = [];

    for (const p of profiles || []) {
      const userSubs = submissionsByUser.get(p.user_id) || [];
      const name = p.full_name || "Unknown";
      const roll = p.roll_no || "";
      const marks = marksMap.get(p.user_id) ?? 0;

      // Helper: build a scalar cell value for a column key
      const scalarVal = (key: string): string | number => {
        switch (key) {
          case "marks":
            return marks;
          case "total_submissions":
            return p.total_submissions || 0;
          case "beginner_submissions":
            return userSubs.filter((s: any) => s.level === "Beginner").length;
          case "intermediate_submissions":
            return userSubs.filter((s: any) => s.level === "Intermediate")
              .length;
          case "advanced_submissions":
            return userSubs.filter((s: any) => s.level === "Advanced").length;
          case "mixed_submissions":
            return userSubs.filter((s: any) => s.level === "Mixed").length;
          default:
            return "";
        }
      };

      if (wantLinks && userSubs.length > 0) {
        // ── Multi-row layout: one row per submission ──
        for (let i = 0; i < userSubs.length; i++) {
          const isFirst = i === 0;
          const cells: (string | number | "")[] = [
            isFirst ? name : "",
            isFirst ? roll : "",
          ];

          for (const key of columnOrder) {
            if (key === "coursera_link") {
              cells.push(userSubs[i].coursera_link || "");
            } else if (key === "linkedin_link") {
              cells.push(userSubs[i].linkedin_link || "");
            } else {
              // Scalar columns: only show on first row
              cells.push(isFirst ? scalarVal(key) : "");
            }
          }
          rows.push({ cells });
        }
      } else if (wantLinks && userSubs.length === 0) {
        // Student has no correct submissions but we still show them
        const cells: (string | number | "")[] = [name, roll];
        for (const key of columnOrder) {
          if (key === "coursera_link" || key === "linkedin_link") {
            cells.push("");
          } else {
            cells.push(scalarVal(key));
          }
        }
        rows.push({ cells });
      } else {
        // ── Single-row layout: no links selected ──
        const cells: (string | number | "")[] = [name, roll];
        for (const key of columnOrder) {
          cells.push(scalarVal(key));
        }
        rows.push({ cells });
      }
    }

    const xml = generateExcelXML(headers, rows);
    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.ms-excel",
        "Content-Disposition": "attachment; filename=submissions_report.xls",
      },
    });
  } catch (e: any) {
    console.error("Admin export error:", e);
    const status = e.message === "Unauthorized" ? 401 : e.message === "Forbidden" ? 403 : 500;
    const msg = status === 500 ? "An internal server error occurred." : e.message;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
