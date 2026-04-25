import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ExternalLink, ChevronDown, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type Submission = {
  id: string;
  coursera_link: string;
  linkedin_link: string;
  project_link: string | null;
  coursera_course: string | null;
  error_message: string | null;
  status: string;
  created_at: string;
  level: string | null;
};

export default function MySubmissions() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const fetchSubmissions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("submissions")
      .select("*")
      .eq("user_id", user.id)
      .neq("status", "processing")
      .order("created_at", { ascending: false });
    if (data) setSubmissions(data);
    setLoading(false);
  };
  useEffect(() => {
    fetchSubmissions();
  }, [user]);

  const levelOrder = ["Beginner", "Intermediate", "Advanced", "Mixed"];
  const levelColors: Record<string, string> = {
    Beginner: "bg-green-500",
    Intermediate: "bg-yellow-500",
    Advanced: "bg-red-500",
    Mixed: "bg-purple-500",
  };

  // Only count/display correct submissions as "accepted"
  const correctSubmissions = submissions.filter(s => s.status === "correct");

  const groupedByLevel = correctSubmissions.reduce<Record<string, Submission[]>>((acc, s) => {
    const level = s.level || "Mixed";
    if (!acc[level]) acc[level] = [];
    acc[level].push(s);
    return acc;
  }, {});

  useEffect(() => {
    const defaults: Record<string, boolean> = {};
    levelOrder.forEach((l) => { if (groupedByLevel[l]) defaults[l] = true; });
    setOpenGroups(defaults);
  }, [correctSubmissions.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container py-10 space-y-6">
      <h1 className="text-2xl font-bold">My Submissions</h1>

      {/* ── Accepted submissions grouped by level ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <h2 className="text-lg font-semibold">Accepted ({correctSubmissions.length})</h2>
        </div>

        {correctSubmissions.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">No accepted submissions yet. Submit your first project!</p>
            </CardContent>
          </Card>
        ) : (
          levelOrder
            .filter((level) => groupedByLevel[level]?.length)
            .map((level) => {
              const subs = groupedByLevel[level];
              return (
                <Collapsible
                  key={level}
                  open={openGroups[level] ?? true}
                  onOpenChange={(open) => setOpenGroups((prev) => ({ ...prev, [level]: open }))}
                >
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer select-none hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`h-2.5 w-2.5 rounded-full ${levelColors[level]}`} />
                            <CardTitle className="text-lg">{level}</CardTitle>
                            <span className="text-sm text-muted-foreground">({subs.length})</span>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openGroups[level] ? "rotate-180" : ""}`} />
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>#</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Course</TableHead>
                                <TableHead>Links</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {subs.map((s, i) => (
                                <TableRow key={s.id}>
                                  <TableCell className="font-medium">{subs.length - i}</TableCell>
                                  <TableCell className="whitespace-nowrap">{format(new Date(s.created_at), "MMM d, yyyy HH:mm")}</TableCell>
                                  <TableCell className="max-w-[200px] truncate">{s.coursera_course || "—"}</TableCell>
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
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })
        )}
      </div>

    </div>
  );
}