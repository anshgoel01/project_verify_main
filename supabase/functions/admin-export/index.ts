import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeCSV(val: string) {
  return `"${(val || "").replace(/"/g, '""')}"`;
}

// Generate a simple Excel XML (SpreadsheetML) that Excel/Sheets can open natively
function generateExcelXML(headers: string[], rows: (string | number)[][]) {
  const escapeXml = (v: any) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const headerCells = headers.map(h => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join("");
  const dataRows = rows.map(row => {
    const cells = row.map(cell => {
      const type = typeof cell === "number" ? "Number" : "String";
      return `<Cell><Data ss:Type="${type}">${escapeXml(cell)}</Data></Cell>`;
    });
    return `<Row>${cells.join("")}</Row>`;
  }).join("\n");

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
    const reportType = url.searchParams.get("type") || "summary"; // "links" or "summary"

    if (reportType === "links") {
      // Report 1: Student Name, Roll No, Coursera Link, LinkedIn Link
      let query = adminClient
        .from("submissions")
        .select("user_id, coursera_link, linkedin_link, college_id, created_at")
        .order("created_at", { ascending: false });

      if (collegeId && collegeId !== "all") query = query.eq("college_id", collegeId);

      const { data: submissions, error } = await query;
      if (error) throw error;

      const userIds = [...new Set((submissions || []).map((s: any) => s.user_id))];
      const profilesRes = userIds.length > 0
        ? await adminClient.from("profiles").select("user_id, full_name, roll_no").in("user_id", userIds)
        : { data: [] };
      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p]));

      const headers = ["Student Name", "Roll No", "Coursera Link", "LinkedIn Link"];
      const rows = (submissions || []).map((s: any) => {
        const profile = profileMap.get(s.user_id);
        return [
          profile?.full_name || "Unknown",
          profile?.roll_no || "",
          s.coursera_link || "",
          s.linkedin_link || "",
        ];
      });

      const xml = generateExcelXML(headers, rows);
      return new Response(xml, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.ms-excel",
          "Content-Disposition": "attachment; filename=submissions_links.xls",
        },
      });
    }

    // Report 2 (summary): Student Name, Roll No, Number of Submissions, Marks
    let query = adminClient
      .from("profiles")
      .select("full_name, roll_no, total_submissions, college_id, colleges(name)")
      .order("full_name", { ascending: true });

    if (collegeId && collegeId !== "all") query = query.eq("college_id", collegeId);

    const { data, error } = await query;
    if (error) throw error;

    const headers = ["Student Name", "Roll No", "Number of Submissions", "Marks"];
    const rows = (data || []).map((d: any) => {
      const subs = d.total_submissions || 0;
      const marks = Math.floor(subs / 3);
      return [d.full_name || "Unknown", d.roll_no || "", subs, marks];
    });

    const xml = generateExcelXML(headers, rows);
    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.ms-excel",
        "Content-Disposition": "attachment; filename=submissions_report.xls",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});

// import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// const corsHeaders = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
// };

// Deno.serve(async (req) => {
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

//     const url = new URL(req.url);
//     const collegeId = url.searchParams.get("college_id");

//     let query = adminClient
//       .from("profiles")
//       .select("full_name, roll_no, total_submissions, college_id, colleges(name)")
//       .order("full_name", { ascending: true });

//     if (collegeId && collegeId !== "all") query = query.eq("college_id", collegeId);

//     const { data, error } = await query;
//     if (error) throw error;

//     // CSV: Student Name, Roll No, Number of Submissions, Marks (floor(submissions / 3))
//     const headers = ["Student Name", "Roll No", "Number of Submissions", "Marks"];
//     const rows = (data || []).map((d: any) => {
//       const subs = d.total_submissions || 0;
//       const marks = Math.floor(subs / 3);
//       return [
//         `"${(d.full_name || "").replace(/"/g, '""')}"`,
//         `"${(d.roll_no || "").replace(/"/g, '""')}"`,
//         subs,
//         marks,
//       ].join(",");
//     });

//     const csv = [headers.join(","), ...rows].join("\n");

//     return new Response(csv, {
//       headers: {
//         ...corsHeaders,
//         "Content-Type": "text/csv",
//         "Content-Disposition": "attachment; filename=submissions_report.csv",
//       },
//     });
//   } catch (e) {
//     return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
//   }
// });
