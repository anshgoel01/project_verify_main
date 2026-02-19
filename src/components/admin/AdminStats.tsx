import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Users, FileCheck, CheckCircle, XCircle, BarChart3 } from "lucide-react";

type Stats = {
  totalStudents: number;
  totalSubmissions: number;
  correctCount: number;
  wrongCount: number;
  processingCount: number;
  skippedCount: number;
  collegePerformance: { name: string; students: number; correct: number; total: number; score: number }[];
};

export default function AdminStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError("No active session found");
          setLoading(false);
          return;
        }

        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-stats`;
        console.log("Fetching stats from:", url);

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("Stats fetch error:", res.status, text);
          setError(`Failed to load stats (${res.status})`);
          setLoading(false);
          return;
        }

        const data = await res.json();
        setStats(data);
      } catch (err: any) {
        console.error("Stats network error:", err);
        setError(`Error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (error || !stats) return <p className="text-center text-destructive py-8">{error}</p>;

  const correctPct = stats.totalSubmissions > 0 ? Math.round((stats.correctCount / stats.totalSubmissions) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.totalStudents}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Submissions</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.totalSubmissions}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Correct</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-primary">{stats.correctCount} <span className="text-sm font-normal text-muted-foreground">({correctPct}%)</span></p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Wrong / Failed</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{stats.wrongCount + stats.skippedCount}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="h-5 w-5" /> College Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.collegePerformance.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No data yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>College</TableHead>
                  <TableHead className="text-center">Active Students</TableHead>
                  <TableHead className="text-center">Total Submissions</TableHead>
                  <TableHead className="text-center">Correct</TableHead>
                  <TableHead className="text-center">Total Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.collegePerformance.sort((a, b) => b.score - a.score).map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-center">{c.students}</TableCell>
                    <TableCell className="text-center">{c.total}</TableCell>
                    <TableCell className="text-center">{c.correct}</TableCell>
                    <TableCell className="text-center font-bold text-primary">{c.score}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
