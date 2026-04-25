import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Loader2, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

type LeaderboardEntry = {
  user_id: string;
  full_name: string;
  college_name: string;
  college_id: string;
  correct_submissions: number;
  score: number;
  updated_at: string;
};

export default function Leaderboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [colleges, setColleges] = useState<{ id: string; name: string }[]>([]);
  const [selectedCollege, setSelectedCollege] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalEntries, setTotalEntries] = useState(0);
  const PAGE_SIZE = 100;

  const [highlightedUserId, setHighlightedUserId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  useEffect(() => {
    supabase.from("colleges").select("id, name").order("name").then(({ data }) => {
      if (data) setColleges(data);
    });
  }, []);

  const fetchLeaderboard = useCallback(async (pageNum = 1, isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    let query = supabase
      .from("profiles")
      .select("user_id, full_name, college_id, correct_submissions, score, updated_at, colleges(name)", { count: "exact" })
      .gt("score", 0)
      .order("score", { ascending: false })
      .order("updated_at", { ascending: true })
      .range((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE - 1);

    if (selectedCollege !== "all") {
      query = query.eq("college_id", selectedCollege);
    }

    const { data, count } = await query;
    if (data) {
      const newEntries = data.map((d: any) => ({
        ...d,
        college_name: d.colleges?.name || "Unknown",
      }));
      setEntries((prev) => (isLoadMore ? [...prev, ...newEntries] : newEntries));
      setHasMore(data.length === PAGE_SIZE);
      if (count !== null) setTotalEntries(count);
    }

    if (isLoadMore) setLoadingMore(false);
    else setLoading(false);
  }, [selectedCollege]);

  useEffect(() => {
    setPage(1);
    fetchLeaderboard(1, false);
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
                  {[...Array(10)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="h-4 w-4 bg-muted animate-pulse rounded mx-auto" /></TableCell>
                      <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-40 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-12 bg-muted animate-pulse rounded mx-auto" /></TableCell>
                      <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded mx-auto" /></TableCell>
                      <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
                      <TableCell className="text-center">{e.correct_submissions}</TableCell>
                      <TableCell className="text-center font-bold text-primary">{(Number(e.score) * 100).toFixed(2)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {format(new Date(e.updated_at), "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Kaggle style footer */}
              {totalEntries > PAGE_SIZE && (
                <div className="flex items-center py-6 border-t mt-4 text-sm text-muted-foreground bg-card gap-4 pl-4">
                  <div>
                    {entries.length} - {totalEntries}
                  </div>
                  <div>
                    {hasMore ? (
                      <Button
                        variant="outline"
                        className="rounded-full px-6 bg-background shadow-sm hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          const nextPage = page + 1;
                          setPage(nextPage);
                          fetchLeaderboard(nextPage, true);
                        }}
                        disabled={loadingMore}
                      >
                        {loadingMore ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ChevronDown className="mr-2 h-4 w-4" />
                        )}
                        See {totalEntries - entries.length} More
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="rounded-full px-6 bg-background shadow-sm hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          setPage(1);
                          fetchLeaderboard(1, false);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        <ChevronUp className="mr-2 h-4 w-4" />
                        Show Less
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}