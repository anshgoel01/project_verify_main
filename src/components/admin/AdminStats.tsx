import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, FileCheck, BarChart3, TrendingUp, Download, ChevronDown, Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line,
} from "recharts";

type Stats = {
  totalStudents: number;
  totalSubmissions: number;
  levelCounts: Record<string, number>;
};

type DailyCount = { date: string; count: number };

function useCountUp(target: number, duration = 1500) {
  const [value, setValue] = useState(0);
  const ref = useRef<number>();
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.floor(progress * target));
      if (progress < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target, duration]);
  return value;
}

const LEVEL_COLORS: Record<string, string> = {
  Beginner: "hsl(142, 71%, 45%)",
  Intermediate: "hsl(38, 92%, 50%)",
  Advanced: "hsl(0, 72%, 51%)",
  Mixed: "hsl(271, 91%, 65%)",
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

const OPTIONAL_COLUMNS = [
  { key: "coursera_link", label: "Coursera Link" },
  { key: "linkedin_link", label: "LinkedIn Link" },
  { key: "marks", label: "Marks" },
  { key: "total_submissions", label: "Total Submissions" },
  { key: "beginner_submissions", label: "Beginner Submissions" },
  { key: "intermediate_submissions", label: "Intermediate Submissions" },
  { key: "advanced_submissions", label: "Advanced Submissions" },
  { key: "mixed_submissions", label: "Mixed Submissions" },
] as const;

export default function AdminStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [daily, setDaily] = useState<DailyCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [exporting, setExporting] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(["coursera_link", "linkedin_link", "marks"]);
  const [colleges, setColleges] = useState<{ id: string; name: string }[]>([]);
  const [selectedCollege, setSelectedCollege] = useState("all");
  const [allowSubmissions, setAllowSubmissions] = useState(true);
  const [updatingConfig, setUpdatingConfig] = useState(false);

  useEffect(() => {
    supabase
      .from("system_config" as any)
      .select("value")
      .eq("key", "allow_submissions")
      .maybeSingle()
      .then(({ data }: any) => {
        if (data && typeof data.value === "boolean") {
          setAllowSubmissions(data.value);
        }
      });
  }, []);

  const handleToggleSubmissions = async (checked: boolean) => {
    setUpdatingConfig(true);
    try {
      const { error } = await supabase
        .from("system_config" as any)
        .upsert({ key: "allow_submissions", value: checked });

      if (error) throw error;
      setAllowSubmissions(checked);
      toast.success(`Submissions ${checked ? "enabled" : "disabled"} successfully.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update submission state.");
    } finally {
      setUpdatingConfig(false);
    }
  };

  useEffect(() => {
    supabase.from("colleges").select("id, name").order("name").then(({ data }) => {
      if (data) setColleges(data);
    });
  }, []);

  const toggleColumn = (key: string) => {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleExport = async () => {
    if (selectedColumns.length === 0) {
      toast.error("Select at least one optional column");
      return;
    }
    setExporting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const params = new URLSearchParams();
    params.set("columns", selectedColumns.join(","));
    if (selectedCollege !== "all") params.set("college_id", selectedCollege);

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-export?${params}`,
      { headers: { Authorization: `Bearer ${session?.access_token}` } }
    );
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "submissions_report.xls";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      toast.error("Failed to export");
    }
    setExporting(false);
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc("get_admin_dashboard_stats");
        if (rpcError) throw rpcError;

        if (data) {
          const statsData = data as any;
          setStats({
            totalStudents: statsData.totalStudents,
            totalSubmissions: statsData.totalSubmissions,
            levelCounts: statsData.levelCounts,
          });

          // Ensure 14 days of data even if there are empty days (using local timezone, not UTC)
          const dayMap: Record<string, number> = {};
          for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            dayMap[localDateStr] = 0;
          }

          if (Array.isArray(statsData.dailyCounts)) {
            statsData.dailyCounts.forEach((d: { date: string; count: number }) => {
              if (d && d.date) {
                const dateKey = d.date.slice(0, 10);
                if (dateKey in dayMap) {
                  dayMap[dateKey] += d.count;
                }
              }
            });
          }

          setDaily(Object.entries(dayMap).map(([date, count]) => ({
            date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            count,
          })));
        }

      } catch (err: unknown) {
        console.error("RPC fetch stats error:", err);
        setError("Failed to load stats. Please check network.");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const studentCount = useCountUp(stats?.totalStudents ?? 0);
  const submissionCount = useCountUp(stats?.totalSubmissions ?? 0);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (error || !stats) return <p className="text-center text-destructive py-8">{error}</p>;

  const levelData = Object.entries(stats.levelCounts || {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      {/* Quick Actions / Download Section */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 sm:py-6 gap-4">
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold">Admin Reports</CardTitle>
              <p className="text-sm text-muted-foreground">Download detailed submission data for all students.</p>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center space-x-2 bg-background border rounded-lg px-3 py-2 h-11 shadow-sm">
                <Switch 
                  id="submission-toggle" 
                  checked={allowSubmissions} 
                  onCheckedChange={handleToggleSubmissions}
                  disabled={updatingConfig}
                />
                <Label htmlFor="submission-toggle" className="text-sm font-semibold cursor-pointer">
                  {allowSubmissions ? "Submissions" : "Disabled"}
                </Label>
              </div>

              {/* <Select value={selectedCollege} onValueChange={setSelectedCollege}>
                <SelectTrigger className="w-[180px] bg-background">
                  <SelectValue placeholder="All Colleges" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Colleges</SelectItem>
                  {colleges.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select> */}

              {/* Download Report Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="lg" className="gap-2 shadow-lg shadow-primary/20">
                    {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                    Download Report <ChevronDown className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-4 space-y-3">
                  <p className="text-sm font-semibold">Report Columns</p>
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                    <div className="flex items-center gap-2 opacity-70">
                      <Checkbox checked disabled />
                      <Label className="flex items-center gap-1"><Lock className="h-3 w-3" /> Student Name</Label>
                    </div>
                    <div className="flex items-center gap-2 opacity-70">
                      <Checkbox checked disabled />
                      <Label className="flex items-center gap-1"><Lock className="h-3 w-3" /> Roll No</Label>
                    </div>
                    {OPTIONAL_COLUMNS.map((col) => (
                      <div key={col.key} className="flex items-center gap-2">
                        <Checkbox
                          id={col.key}
                          checked={selectedColumns.includes(col.key)}
                          onCheckedChange={() => toggleColumn(col.key)}
                        />
                        <Label htmlFor={col.key} className="cursor-pointer text-xs">{col.label}</Label>
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full gap-2 mt-2"
                    disabled={exporting || selectedColumns.length === 0}
                    onClick={handleExport}
                  >
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Generate .xls Report
                  </Button>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
        </Card>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUp}>
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
              <Users className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black">{studentCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Registered on VerifyHub</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div custom={1} initial="hidden" animate="visible" variants={fadeUp}>
          <Card className="border-green-500/20 bg-green-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Submissions</CardTitle>
              <FileCheck className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black">{submissionCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Projects submitted for verification</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Level Distribution */}
        <motion.div custom={2} initial="hidden" animate="visible" variants={fadeUp}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5" /> Submissions by Level
              </CardTitle>
            </CardHeader>
            <CardContent>
              {levelData.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No data yet.</p>
              ) : (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={levelData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={1200}>
                        {levelData.map((entry) => (
                          <Cell key={entry.name} fill={LEVEL_COLORS[entry.name] || "hsl(var(--primary))"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-3 justify-center">
                    {levelData.map((l) => (
                      <div key={l.name} className="flex items-center gap-1.5 text-sm">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LEVEL_COLORS[l.name] }} />
                        {l.name}: <span className="font-semibold">{l.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Submissions Over Time */}
        <motion.div custom={3} initial="hidden" animate="visible" variants={fadeUp}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5" /> Submission Activity
              </CardTitle>
              <p className="text-xs text-muted-foreground">Correct submissions — last 14 days</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "hsl(var(--primary))" }}
                    animationDuration={1500}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

