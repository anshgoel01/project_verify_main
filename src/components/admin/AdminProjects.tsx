import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, FolderOpen, Save, CheckCircle, Settings2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const LEVELS = ["Beginner", "Intermediate", "Advanced", "Mixed"] as const;
const DEFAULT_WEIGHTS: Record<string, number> = {
  Beginner: 0.25,
  Intermediate: 0.50,
  Advanced: 0.75,
  Mixed: 0.60,
};

const LEVEL_COLORS: Record<string, string> = {
  Beginner: "bg-emerald-500",
  Intermediate: "bg-amber-500",
  Advanced: "bg-red-500",
  Mixed: "bg-violet-500",
};

type Project = {
  id: string;
  course_name: string;
  level: string;
  weight: number;
};

export default function AdminProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [localEdits, setLocalEdits] = useState<Record<string, { level: string; weight: number }>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const [levelWeights, setLevelWeights] = useState<Record<string, number>>({ ...DEFAULT_WEIGHTS });
  const [localWeights, setLocalWeights] = useState<Record<string, number>>({ ...DEFAULT_WEIGHTS });
  const [savingWeights, setSavingWeights] = useState(false);

  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${session?.access_token}` };
  };

  const fetchWeights = async () => {
    const headers = await getAuthHeader();
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-projects?action=weights`,
        { headers }
      );
      if (res.ok) {
        const data: { level: string; weight: number }[] = await res.json();
        const map: Record<string, number> = {};
        for (const row of data) map[row.level] = Number(row.weight);
        // if (Object.keys(map).length > 0) {
        const merged = { ...DEFAULT_WEIGHTS, ...map };
        setLevelWeights(merged);
        setLocalWeights(merged);
        // }
      }
    } catch {
      // fall back to defaults
    }
  };

  const fetchProjects = async (sync = false) => {
    setLoading(true);
    const headers = await getAuthHeader();
    const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-projects`);
    if (sync) url.searchParams.set("sync", "true");

    const res = await fetch(
      url.toString(),
      { headers }
    );
    if (res.ok) {
      // const data: Project[] = await res.json();
      // setProjects(data);
      // const edits: Record<string, { level: string; weight: number }> = {};
      // for (const p of data) {
      //   edits[p.id] = { level: p.level || "Beginner", weight: p.weight ?? 0.25 };
      // }
      const raw = await res.json();
      const data: Project[] = raw.map((p: any) => ({ ...p, weight: Number(p.weight) }));
      setProjects(data);
      const edits: Record<string, { level: string; weight: number }> = {};
      for (const p of data) {
        edits[p.id] = { level: p.level || "Beginner", weight: Number(p.weight) ?? 0.25 };
      }
      setLocalEdits(edits);
      setSaved({});
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWeights();
    fetchProjects();
  }, []);

  const handleSaveWeights = async () => {
    setSavingWeights(true);
    const headers = await getAuthHeader();
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-projects`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ weights: localWeights }),
        }
      );
      if (res.ok) {
        toast.success("Level weights saved");
        await fetchWeights();
        await fetchProjects();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(`Failed to save weights: ${err.error || res.statusText}`);
      }
    } catch (e) {
      toast.error(`Failed to save weights: ${e}`);
    }
    setSavingWeights(false);
  };

  const isUnsaved = (id: string) => {
    const p = projects.find((proj) => proj.id === id);
    const edit = localEdits[id];
    if (!p || !edit) return false;
    // return edit.level !== p.level || Math.abs(edit.weight - p.weight) > 0.001;
    return edit.level !== p.level || Math.abs(edit.weight - Number(p.weight)) > 0.001;
  };

  const handleLevelChange = (id: string, newLevel: string) => {
    setLocalEdits((prev) => {
      const old = prev[id];
      const oldDefault = levelWeights[old?.level || "Beginner"] ?? 0.25;
      const isDefault = Math.abs((old?.weight ?? 0) - oldDefault) < 0.001;
      return {
        ...prev,
        [id]: {
          level: newLevel,
          weight: isDefault ? (levelWeights[newLevel] ?? 0.25) : old.weight,
        },
      };
    });
    setSaved((prev) => ({ ...prev, [id]: false }));
  };

  const handleWeightChange = (id: string, val: number) => {
    setLocalEdits((prev) => ({ ...prev, [id]: { ...prev[id], weight: val } }));
    setSaved((prev) => ({ ...prev, [id]: false }));
  };

  const handleSave = async (id: string) => {
    setSaving((prev) => ({ ...prev, [id]: true }));
    const edit = localEdits[id];
    const headers = await getAuthHeader();
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-projects`,
        {
          method: "PUT",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ id, level: edit.level, weight: edit.weight }),
        }
      );
      if (res.ok) {
        toast.success("Project saved");
        setSaved((prev) => ({ ...prev, [id]: true }));
        await fetchProjects();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(`Failed to save: ${err.error || res.statusText}`);
      }
    } catch (e) {
      toast.error(`Failed to save: ${e}`);
    }
    setSaving((prev) => ({ ...prev, [id]: false }));
  };

  const grouped = LEVELS.reduce((acc, level) => {
    acc[level] = projects.filter((p) => (localEdits[p.id]?.level || p.level || "Beginner") === level);
    return acc;
  }, {} as Record<string, Project[]>);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-primary" />
            Level Weights
          </CardTitle>
          <CardDescription>Set default weight for each level</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {LEVELS.map((level) => (
              <div key={level} className="flex items-center gap-2 rounded-lg border p-3">
                <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${LEVEL_COLORS[level]}`} />
                <span className="text-sm font-medium flex-1">{level}</span>
                <Input
                  type="number"
                  value={(localWeights[level] ?? 0).toFixed(2)}
                  onChange={(e) =>
                    setLocalWeights((prev) => ({
                      ...prev,
                      [level]: Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)),
                    }))
                  }
                  className="w-[70px] h-8 text-xs text-center p-1"
                  min={0}
                  max={1}
                  step={0.01}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-4">
            <Button size="sm" onClick={handleSaveWeights} disabled={savingWeights}>
              {savingWeights ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save All
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Project Monitoring Panel</h2>
          <span className="text-sm text-muted-foreground ml-2">
            {projects.length} unique project{projects.length !== 1 ? "s" : ""}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchProjects(true)}
          disabled={loading}
          className="gap-2"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Settings2 className="h-3 w-3" />}
          Sync from Submissions
        </Button>
      </div>

      {LEVELS.map((level) => {
        const items = grouped[level];
        return (
          <Card key={level}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${LEVEL_COLORS[level]}`} />
                  {level}
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  Default: {(levelWeights[level] ?? 0).toFixed(2)} · {items.length} project{items.length !== 1 ? "s" : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No projects at this level.</p>
              ) : (
                <div className="space-y-3">
                  {items.map((p) => {
                    const edit = localEdits[p.id];
                    const unsaved = isUnsaved(p.id);
                    return (
                      <div key={p.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border p-3 ${unsaved ? "border-amber-500/50 bg-amber-500/5" : ""}`}>
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <p className="text-sm font-medium truncate" title={p.course_name}>{p.course_name}</p>
                          {unsaved && (
                            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 flex-shrink-0">
                              <AlertCircle className="h-3 w-3" />
                              unsaved
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <Select value={edit?.level || p.level || "Beginner"} onValueChange={(v) => handleLevelChange(p.id, v)}>
                            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {LEVELS.map((l) => (<SelectItem key={l} value={l}>{l}</SelectItem>))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            value={(edit?.weight ?? p.weight).toFixed(2)}
                            onChange={(e) => handleWeightChange(p.id, Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)))}
                            className="w-[70px] h-8 text-xs text-center p-1"
                            min={0} max={1} step={0.01}
                          />
                          <Button
                            size="sm"
                            variant={saved[p.id] ? "ghost" : unsaved ? "default" : "outline"}
                            onClick={() => handleSave(p.id)}
                            disabled={saving[p.id]}
                            className="h-8 w-8 p-0"
                          >
                            {saving[p.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : saved[p.id] ? <CheckCircle className="h-4 w-4 text-primary" /> : <Save className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}