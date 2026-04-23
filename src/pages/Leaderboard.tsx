import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Loader2, MapPin } from "lucide-react";
import { format } from "date-fns";

type LeaderboardEntry = {
  user_id: string;
  full_name: string;
  college_name: string;
  college_id: string;
  total_submissions: number;
  score: number;
  updated_at: string;
};

export default function Leaderboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [colleges, setColleges] = useState<{ id: string; name: string }[]>([]);
  const [selectedCollege, setSelectedCollege] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [highlightedUserId, setHighlightedUserId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  useEffect(() => {
    supabase.from("colleges").select("id, name").order("name").then(({ data }) => {
      if (data) setColleges(data);
    });
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("profiles")
      .select("user_id, full_name, college_id, total_submissions, score, updated_at, colleges(name)")
      .gt("total_submissions", 0)
      .order("score", { ascending: false })
      .order("updated_at", { ascending: true })
      .limit(100);

    if (selectedCollege !== "all") {
      query = query.eq("college_id", selectedCollege);
    }

    const { data } = await query;
    if (data) {
      setEntries(
        data.map((d: any) => ({
          ...d,
          college_name: d.colleges?.name || "Unknown",
        }))
      );
    }
    setLoading(false);
  }, [selectedCollege]);

  useEffect(() => {
    fetchLeaderboard();

    const channel = supabase
      .channel("leaderboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        fetchLeaderboard();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchLeaderboard]);

  const myRankIndex = user ? entries.findIndex((e) => e.user_id === user.id) : -1;
  const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null;

  const handleScrollToMyRank = () => {
    if (!user || myRankIndex < 0) return;
    const row = rowRefs.current[user.id];
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedUserId(user.id);
      setTimeout(() => setHighlightedUserId(null), 2000);
    }
  };

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
          <div className="flex items-center gap-3">
            {user && myRank && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleScrollToMyRank}
                className="gap-2"
              >
                <MapPin className="h-4 w-4" />
                My Rank
                <Badge variant="secondary" className="ml-1">#{myRank}</Badge>
              </Button>
            )}
          </div>
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
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead>Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e, i) => (
                    <TableRow
                      key={e.user_id}
                      ref={(el) => { rowRefs.current[e.user_id] = el; }}
                      className={
                        highlightedUserId === e.user_id
                          ? "animate-pulse bg-primary/15 transition-colors duration-700"
                          : user?.id === e.user_id
                            ? "bg-primary/5"
                            : ""
                      }
                    >
                      <TableCell className="text-center">{rankIcon(i + 1)}</TableCell>
                      <TableCell className="font-medium">{e.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{e.college_name}</TableCell>
                      <TableCell className="text-center">{e.total_submissions}</TableCell>
                      <TableCell className="text-center font-bold text-primary">{(Number(e.score) * 100).toFixed(2)}</TableCell>
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