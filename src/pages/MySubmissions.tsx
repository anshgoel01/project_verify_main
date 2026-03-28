import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ExternalLink, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type Submission = {
  id: string;
  coursera_link: string;
  linkedin_link: string;
  coursera_course: string | null;
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

    const channel = supabase
      .channel("my-submissions")
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `user_id=eq.${user?.id}` }, () => {
        fetchSubmissions();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const levelOrder = ["Beginner", "Intermediate", "Advanced", "Mixed"];
  const levelColors: Record<string, string> = {
    Beginner: "bg-green-500",
    Intermediate: "bg-yellow-500",
    Advanced: "bg-red-500",
    Mixed: "bg-purple-500",
  };

  const groupedByLevel = submissions.reduce<Record<string, Submission[]>>((acc, s) => {
    const level = s.level || "Mixed";
    if (!acc[level]) acc[level] = [];
    acc[level].push(s);
    return acc;
  }, {});

  useEffect(() => {
    const defaults: Record<string, boolean> = {};
    levelOrder.forEach((l) => { if (groupedByLevel[l]) defaults[l] = true; });
    setOpenGroups(defaults);
  }, [submissions.length]);

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
  );
}

// import { useEffect, useState } from "react";
// import { supabase } from "@/integrations/supabase/client";
// import { useAuth } from "@/lib/auth";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// import StatusBadge from "@/components/StatusBadge";
// import { Loader2, ExternalLink, ChevronDown } from "lucide-react";
// import { format } from "date-fns";
// import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// type Submission = {
//   id: string;
//   coursera_link: string;
//   linkedin_link: string;
//   coursera_name: string | null;
//   linkedin_username: string | null;
//   coursera_course: string | null;
//   student_match: boolean | null;
//   course_match: boolean | null;
//   status: string;
//   error_message: string | null;
//   created_at: string;
//   level: string | null;
// };

// export default function MySubmissions() {
//   const { user } = useAuth();
//   const [submissions, setSubmissions] = useState<Submission[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

//   const fetchSubmissions = async () => {
//     if (!user) return;
//     const { data } = await supabase
//       .from("submissions")
//       .select("*")
//       .eq("user_id", user.id)
//       .order("created_at", { ascending: false });
//     if (data) setSubmissions(data);
//     setLoading(false);
//   };

//   useEffect(() => {
//     fetchSubmissions();

//     const channel = supabase
//       .channel("my-submissions")
//       .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `user_id=eq.${user?.id}` }, () => {
//         fetchSubmissions();
//       })
//       .subscribe();

//     return () => { supabase.removeChannel(channel); };
//   }, [user]);

//   const levelOrder = ["Beginner", "Intermediate", "Advanced", "Mixed"];
//   const levelColors: Record<string, string> = {
//     Beginner: "bg-green-500",
//     Intermediate: "bg-yellow-500",
//     Advanced: "bg-red-500",
//     Mixed: "bg-purple-500",
//   };

//   const groupedByLevel = submissions.reduce<Record<string, Submission[]>>((acc, s) => {
//     const level = s.level || "Mixed";
//     if (!acc[level]) acc[level] = [];
//     acc[level].push(s);
//     return acc;
//   }, {});

//   useEffect(() => {
//     const defaults: Record<string, boolean> = {};
//     levelOrder.forEach((l) => { if (groupedByLevel[l]) defaults[l] = true; });
//     setOpenGroups(defaults);
//   }, [submissions.length]);

//   if (loading) {
//     return (
//       <div className="flex items-center justify-center py-20">
//         <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
//       </div>
//     );
//   }

//   return (
//     <div className="container py-10 space-y-6">
//       <h1 className="text-2xl font-bold">My Submissions ({submissions.length})</h1>

//       {submissions.length === 0 ? (
//         <Card>
//           <CardContent className="py-8">
//             <p className="text-center text-muted-foreground">No submissions yet. Submit your first project!</p>
//           </CardContent>
//         </Card>
//       ) : (
//         levelOrder
//           .filter((level) => groupedByLevel[level]?.length)
//           .map((level) => {
//             const subs = groupedByLevel[level];
//             return (
//               <Collapsible
//                 key={level}
//                 open={openGroups[level] ?? true}
//                 onOpenChange={(open) => setOpenGroups((prev) => ({ ...prev, [level]: open }))}
//               >
//                 <Card>
//                   <CollapsibleTrigger asChild>
//                     <CardHeader className="cursor-pointer select-none hover:bg-muted/50 transition-colors">
//                       <div className="flex items-center justify-between">
//                         <div className="flex items-center gap-2">
//                           <div className={`h-2.5 w-2.5 rounded-full ${levelColors[level]}`} />
//                           <CardTitle className="text-lg">{level}</CardTitle>
//                           <span className="text-sm text-muted-foreground">({subs.length})</span>
//                         </div>
//                         <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openGroups[level] ? "rotate-180" : ""}`} />
//                       </div>
//                     </CardHeader>
//                   </CollapsibleTrigger>
//                   <CollapsibleContent>
//                     <CardContent>
//                       <div className="overflow-x-auto">
//                         <Table>
//                           <TableHeader>
//                             <TableRow>
//                               <TableHead>#</TableHead>
//                               <TableHead>Date</TableHead>
//                               <TableHead>Course</TableHead>
//                               <TableHead>Coursera Name</TableHead>
//                               <TableHead>Student Match</TableHead>
//                               <TableHead>Course Match</TableHead>
//                               <TableHead>Status</TableHead>
//                               <TableHead>Links</TableHead>
//                             </TableRow>
//                           </TableHeader>
//                           <TableBody>
//                             {subs.map((s, i) => (
//                               <TableRow key={s.id}>
//                                 <TableCell className="font-medium">{subs.length - i}</TableCell>
//                                 <TableCell className="whitespace-nowrap">{format(new Date(s.created_at), "MMM d, yyyy HH:mm")}</TableCell>
//                                 <TableCell className="max-w-[200px] truncate">{s.coursera_course || "—"}</TableCell>
//                                 <TableCell>{s.coursera_name || "—"}</TableCell>
//                                 <TableCell>{s.student_match === null ? "—" : s.student_match ? "✅ Yes" : "❌ No"}</TableCell>
//                                 <TableCell>{s.course_match === null ? "—" : s.course_match ? "✅ Yes" : "❌ No"}</TableCell>
//                                 <TableCell><StatusBadge status={s.status} /></TableCell>
//                                 <TableCell>
//                                   <div className="flex gap-2">
//                                     <a href={s.coursera_link} target="_blank" rel="noopener" className="text-primary hover:underline">
//                                       <ExternalLink className="h-4 w-4" />
//                                     </a>
//                                     <a href={s.linkedin_link} target="_blank" rel="noopener" className="text-primary hover:underline">
//                                       <ExternalLink className="h-4 w-4" />
//                                     </a>
//                                   </div>
//                                 </TableCell>
//                               </TableRow>
//                             ))}
//                           </TableBody>
//                         </Table>
//                       </div>
//                     </CardContent>
//                   </CollapsibleContent>
//                 </Card>
//               </Collapsible>
//             );
//           })
//       )}
//     </div>
//   );
// }
