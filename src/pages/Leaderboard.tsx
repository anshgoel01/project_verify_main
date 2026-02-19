import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Medal, Loader2 } from "lucide-react";
import { format } from "date-fns";

type LeaderboardEntry = {
  user_id: string;
  full_name: string;
  college_name: string;
  college_id: string;
  total_submissions: number;
  correct_submissions: number;
  score: number;
  updated_at: string;
};

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [colleges, setColleges] = useState<{ id: string; name: string }[]>([]);
  const [selectedCollege, setSelectedCollege] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("colleges").select("id, name").order("name").then(({ data }) => {
      if (data) setColleges(data);
    });
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    let query = supabase
      .from("profiles")
      .select("user_id, full_name, college_id, total_submissions, correct_submissions, score, updated_at, colleges(name)")
      .gt("total_submissions", 0)
      .order("score", { ascending: false })
      .order("updated_at", { ascending: true });

    if (selectedCollege !== "all") {
      query = query.eq("college_id", selectedCollege);
    }

    const { data } = await query;
    if (data) {
      // Create a temporary type for the join result since Supabase types might not be fully inferred
      type LeaderboardJoinResult = {
        user_id: string;
        full_name: string;
        college_id: string;
        total_submissions: number;
        correct_submissions: number;
        score: number;
        updated_at: string;
        colleges: { name: string } | null;
      };

      setEntries(
        (data as unknown as LeaderboardJoinResult[]).map((d) => ({
          ...d,
          college_name: d.colleges?.name || "Unknown",
        }))
      );
    }
    setLoading(false);
  }, [selectedCollege]);

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard();

    const channel = supabase
      .channel("leaderboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        fetchLeaderboard();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchLeaderboard]);

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="text-muted-foreground font-mono">{rank}</span>;
  };

  return (
    <div className="container py-10">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> Leaderboard
          </CardTitle>
          <Select value={selectedCollege} onValueChange={setSelectedCollege}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filter by college" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Colleges</SelectItem>
              {colleges.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No submissions yet. Be the first!</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>College</TableHead>
                    <TableHead className="text-center">Submissions</TableHead>
                    <TableHead className="text-center">Correct</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead>Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e, i) => (
                    <TableRow key={e.user_id}>
                      <TableCell className="text-center">{rankIcon(i + 1)}</TableCell>
                      <TableCell className="font-medium">{e.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{e.college_name}</TableCell>
                      <TableCell className="text-center">{e.total_submissions}</TableCell>
                      <TableCell className="text-center">{e.correct_submissions}</TableCell>
                      <TableCell className="text-center font-bold text-primary">{e.score}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {format(new Date(e.updated_at), "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
