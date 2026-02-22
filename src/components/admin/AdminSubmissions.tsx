import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { Loader2, FileCheck, ExternalLink, Trash2, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type Submission = {
  id: string;
  student_name: string;
  student_email: string;
  student_roll_no: string;
  college_name: string;
  coursera_link: string;
  linkedin_link: string;
  coursera_name: string | null;
  coursera_course: string | null;
  student_match: boolean | null;
  course_match: boolean | null;
  status: string;
  error_message: string | null;
  created_at: string;
};

export default function AdminSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [colleges, setColleges] = useState<{ id: string; name: string }[]>([]);
  const [selectedCollege, setSelectedCollege] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const prevFiltersRef = useRef({ college: selectedCollege, status: selectedStatus });

  useEffect(() => {
    supabase.from("colleges").select("id, name").order("name").then(({ data }) => {
      if (data) setColleges(data);
    });
  }, []);

  const fetchSubmissions = useCallback(async (pageOverride?: number) => {
    setLoading(true);
    const filtersChanged = prevFiltersRef.current.college !== selectedCollege || prevFiltersRef.current.status !== selectedStatus;
    if (filtersChanged) {
      prevFiltersRef.current = { college: selectedCollege, status: selectedStatus };
      setPage(1);
    }
    const pageToFetch = pageOverride ?? (filtersChanged ? 1 : page);

    const { data: { session } } = await supabase.auth.getSession();
    const params = new URLSearchParams();
    if (selectedCollege !== "all") params.set("college_id", selectedCollege);
    if (selectedStatus !== "all") params.set("status", selectedStatus);
    params.set("page", String(pageToFetch));
    params.set("limit", "50");

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-submissions?${params}`,
      { headers: { Authorization: `Bearer ${session?.access_token}` } }
    );
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json) ? json : (json.submissions ?? []);
      setSubmissions(list);
      setTotal(Array.isArray(json) ? list.length : (json.total ?? list.length));
      setTotalPages(Array.isArray(json) ? 1 : (json.totalPages ?? 1));
    }
    setLoading(false);
  }, [selectedCollege, selectedStatus, page]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this submission?")) return;
    setDeletingId(id);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-submissions`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      }
    );
    if (res.ok) {
      toast.success("Submission deleted");
      fetchSubmissions();
    } else {
      toast.error("Failed to delete submission");
    }
    setDeletingId(null);
  };

  const handleExport = async (type: "links" | "summary") => {
    setExporting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const params = new URLSearchParams();
    params.set("type", type);
    if (selectedCollege !== "all") params.set("college_id", selectedCollege);

    const filename = type === "links" ? "submissions_links.xls" : "submissions_report.xls";

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-export?${params}`,
      { headers: { Authorization: `Bearer ${session?.access_token}` } }
    );
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      toast.error("Failed to export");
    }
    setExporting(false);
  };

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" /> All Submissions
          </CardTitle>
          <div className="flex gap-2">
            <Button onClick={() => handleExport("links")} disabled={exporting} variant="outline" className="gap-2" size="sm">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Links Report
            </Button>
            <Button onClick={() => handleExport("summary")} disabled={exporting} variant="outline" className="gap-2" size="sm">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Marks Report
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={selectedCollege} onValueChange={setSelectedCollege}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Colleges" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Colleges</SelectItem>
              {colleges.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="correct">Correct</SelectItem>
              <SelectItem value="wrong">Wrong</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : submissions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No submissions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Roll No</TableHead>
                  <TableHead>College</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Links</TableHead>
                  <TableHead className="w-16">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.student_name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.student_roll_no || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{s.college_name}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{format(new Date(s.created_at), "MMM d, HH:mm")}</TableCell>
                    <TableCell><StatusBadge status={s.status} /></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <a href={s.coursera_link} target="_blank" rel="noopener" className="text-primary hover:underline"><ExternalLink className="h-4 w-4" /></a>
                        <a href={s.linkedin_link} target="_blank" rel="noopener" className="text-primary hover:underline"><ExternalLink className="h-4 w-4" /></a>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(s.id)}
                        disabled={deletingId === s.id}
                      >
                        {deletingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {!loading && submissions.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {((page - 1) * 50) + 1}-{Math.min(page * 50, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <span className="text-sm">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
