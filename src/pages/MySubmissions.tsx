import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/StatusBadge";
import { Loader2, ExternalLink } from "lucide-react";
import { format } from "date-fns";

type Submission = {
  id: string;
  coursera_link: string;
  linkedin_link: string;
  coursera_name: string | null;
  linkedin_username: string | null;
  coursera_course: string | null;
  student_match: boolean | null;
  course_match: boolean | null;
  status: string;
  error_message: string | null;
  created_at: string;
};

export default function MySubmissions() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubmissions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("submissions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setSubmissions(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchSubmissions();

    const channel = supabase
      .channel("my-submissions")
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `user_id=eq.${user?.id}` }, () => {
        fetchSubmissions();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Group submissions by course
  const groupedByCourse = submissions.reduce<Record<string, Submission[]>>((acc, s) => {
    const course = s.coursera_course || "Unknown Course";
    if (!acc[course]) acc[course] = [];
    acc[course].push(s);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container py-10 space-y-6">
      <h1 className="text-2xl font-bold">My Submissions ({submissions.length})</h1>

      {submissions.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">No submissions yet. Submit your first project!</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedByCourse).map(([course, subs]) => (
          <Card key={course}>
            <CardHeader>
              <CardTitle className="text-lg">{course}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Student Match</TableHead>
                      <TableHead>Course Match</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Links</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subs.map((s, i) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{subs.length - i}</TableCell>
                        <TableCell className="whitespace-nowrap">{format(new Date(s.created_at), "MMM d, yyyy HH:mm")}</TableCell>
                        <TableCell>{s.student_match === null ? "—" : s.student_match ? "✅ Yes" : "❌ No"}</TableCell>
                        <TableCell>{s.course_match === null ? "—" : s.course_match ? "✅ Yes" : "❌ No"}</TableCell>
                        <TableCell><StatusBadge status={s.status} /></TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <a href={s.coursera_link} target="_blank" rel="noopener" className="text-primary hover:underline">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                            <a href={s.linkedin_link} target="_blank" rel="noopener" className="text-primary hover:underline">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
