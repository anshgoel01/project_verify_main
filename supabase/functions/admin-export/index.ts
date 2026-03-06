import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const userId = claimsData.claims.sub;

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await adminClient.rpc("is_admin", { _user_id: userId });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    const url = new URL(req.url);
    const collegeId = url.searchParams.get("college_id");
    const columnsParam = url.searchParams.get("columns") || "";
    const selectedCols = new Set(columnsParam.split(",").filter(Boolean));

    // Fetch profiles
    let profileQuery = adminClient.from("profiles").select("user_id, full_name, roll_no, total_submissions, college_id");
    if (collegeId && collegeId !== "all") profileQuery = profileQuery.eq("college_id", collegeId);
    const { data: profiles, error: profileError } = await profileQuery.order("full_name", { ascending: true });
    if (profileError) throw profileError;

    // Fetch submissions for link columns or level-based counts
    const needsSubmissions = selectedCols.has("coursera_link") || selectedCols.has("linkedin_link") ||
      selectedCols.has("beginner_submissions") || selectedCols.has("intermediate_submissions") ||
      selectedCols.has("advanced_submissions") || selectedCols.has("mixed_submissions");

    let submissionsByUser: Map<string, any[]> = new Map();
    if (needsSubmissions) {
      let subQuery = adminClient.from("submissions").select("user_id, coursera_link, linkedin_link, level");
      if (collegeId && collegeId !== "all") subQuery = subQuery.eq("college_id", collegeId);
      const { data: subs } = await subQuery;
      for (const s of subs || []) {
        if (!submissionsByUser.has(s.user_id)) submissionsByUser.set(s.user_id, []);
        submissionsByUser.get(s.user_id)!.push(s);
      }
    }

    // Build headers & rows
    const headers: string[] = ["Student Name", "Roll No"];
    const columnOrder: string[] = [];

    const colDefs: { key: string; header: string }[] = [
      { key: "coursera_link", header: "Coursera Link" },
      { key: "linkedin_link", header: "LinkedIn Link" },
      { key: "marks", header: "Marks" },
      { key: "total_submissions", header: "Total Submissions" },
      { key: "beginner_submissions", header: "Beginner Submissions" },
      { key: "intermediate_submissions", header: "Intermediate Submissions" },
      { key: "advanced_submissions", header: "Advanced Submissions" },
      { key: "mixed_submissions", header: "Mixed Submissions" },
    ];

    for (const col of colDefs) {
      if (selectedCols.has(col.key)) {
        headers.push(col.header);
        columnOrder.push(col.key);
      }
    }

    const rows = (profiles || []).map((p: any) => {
      const row: (string | number)[] = [p.full_name || "Unknown", p.roll_no || ""];
      const userSubs = submissionsByUser.get(p.user_id) || [];
      const totalSubs = p.total_submissions || 0;

      for (const key of columnOrder) {
        switch (key) {
          case "coursera_link":
            row.push(userSubs.map((s: any) => s.coursera_link).join(", "));
            break;
          case "linkedin_link":
            row.push(userSubs.map((s: any) => s.linkedin_link).join(", "));
            break;
          case "marks":
            row.push(Math.floor(totalSubs / 3));
            break;
          case "total_submissions":
            row.push(totalSubs);
            break;
          case "beginner_submissions":
            row.push(userSubs.filter((s: any) => s.level === "Beginner").length);
            break;
          case "intermediate_submissions":
            row.push(userSubs.filter((s: any) => s.level === "Intermediate").length);
            break;
          case "advanced_submissions":
            row.push(userSubs.filter((s: any) => s.level === "Advanced").length);
            break;
          case "mixed_submissions":
            row.push(userSubs.filter((s: any) => s.level === "Mixed").length);
            break;
        }
      }
      return row;
    });

    const xml = generateExcelXML(headers, rows);
    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.ms-excel",
        "Content-Disposition": "attachment; filename=submissions_report.xls",
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});

// // @ts-nocheck
// import { createClient } from "supabase";

// const corsHeaders = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
// };

// function escapeCSV(val: string) {
//   return `"${(val || "").replace(/"/g, '""')}"`;
// }

// // Generate a simple Excel XML (SpreadsheetML) that Excel/Sheets can open natively
// function generateExcelXML(headers: string[], rows: (string | number)[][]) {
//   const escapeXml = (v: any) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

//   const headerCells = headers.map(h => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join("");
//   const dataRows = rows.map(row => {
//     const cells = row.map(cell => {
//       const type = typeof cell === "number" ? "Number" : "String";
//       return `<Cell><Data ss:Type="${type}">${escapeXml(cell)}</Data></Cell>`;
//     });
//     return `<Row>${cells.join("")}</Row>`;
//   }).join("\n");

//   return `<?xml version="1.0" encoding="UTF-8"?>
// <?mso-application progid="Excel.Sheet"?>
// <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
//  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
//  <Styles>
//   <Style ss:ID="Header"><Font ss:Bold="1"/></Style>
//  </Styles>
//  <Worksheet ss:Name="Sheet1">
//   <Table>
//    <Row ss:StyleID="Header">${headerCells}</Row>
//    ${dataRows}
//   </Table>
//  </Worksheet>
// </Workbook>`;
// }

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

//     const url = new URL(req.url);
//     const collegeId = url.searchParams.get("college_id");
//     const reportType = url.searchParams.get("type") || "summary"; // "links" or "summary"

//     if (reportType === "links") {
//       // Report 1: Student Name, Roll No, Coursera Link, LinkedIn Link
//       let query = adminClient
//         .from("submissions")
//         .select("user_id, coursera_link, linkedin_link, college_id, created_at")
//         .order("created_at", { ascending: false });

//       if (collegeId && collegeId !== "all") query = query.eq("college_id", collegeId);

//       const { data: submissions, error } = await query;
//       if (error) throw error;

//       const userIds = [...new Set((submissions || []).map((s: any) => s.user_id))];
//       const profilesRes = userIds.length > 0
//         ? await adminClient.from("profiles").select("user_id, full_name, roll_no").in("user_id", userIds)
//         : { data: [] };
//       const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p]));

//       const headers = ["Student Name", "Roll No", "Coursera Link", "LinkedIn Link"];
//       const rows = (submissions || []).map((s: any) => {
//         const profile = profileMap.get(s.user_id) as any;
//         return [
//           profile?.full_name || "Unknown",
//           profile?.roll_no || "",
//           s.coursera_link || "",
//           s.linkedin_link || "",
//         ];
//       });

//       const xml = generateExcelXML(headers, rows);
//       return new Response(xml, {
//         headers: {
//           ...corsHeaders,
//           "Content-Type": "application/vnd.ms-excel",
//           "Content-Disposition": "attachment; filename=submissions_links.xls",
//         },
//       });
//     }

//     // Report 2 (summary): Student Name, Roll No, Number of Submissions, Marks
//     let query = adminClient
//       .from("profiles")
//       .select("full_name, roll_no, total_submissions, college_id, colleges(name)")
//       .order("full_name", { ascending: true });

//     if (collegeId && collegeId !== "all") query = query.eq("college_id", collegeId);

//     const { data, error } = await query;
//     if (error) throw error;

//     const headers = ["Student Name", "Roll No", "Number of Submissions", "Marks"];
//     const rows = (data || []).map((d: any) => {
//       const subs = d.total_submissions || 0;
//       const marks = Math.floor(subs / 3);
//       return [d.full_name || "Unknown", d.roll_no || "", subs, marks];
//     });

//     const xml = generateExcelXML(headers, rows);
//     return new Response(xml, {
//       headers: {
//         ...corsHeaders,
//         "Content-Type": "application/vnd.ms-excel",
//         "Content-Disposition": "attachment; filename=submissions_report.xls",
//       },
//     });
//   } catch (e: any) {
//     return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
//   }
// });
