import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Trophy, CheckCircle, Send, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function Profile() {
  const { profile } = useAuth();
  const [collegeName, setCollegeName] = useState("");

  useEffect(() => {
    if (profile?.college_id) {
      supabase.from("colleges").select("name").eq("id", profile.college_id).single().then(({ data }) => {
        if (data) setCollegeName(data.name);
      });
    }
  }, [profile]);

  if (!profile) return null;

  const stats = [
    { icon: Send, label: "Total Submissions", value: profile.total_submissions },
    { icon: CheckCircle, label: "Correct", value: profile.correct_submissions },
    { icon: Trophy, label: "Score", value: profile.score },
  ];

  return (
    <div className="container max-w-2xl py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-2xl font-bold">{profile.full_name}</p>
            <p className="text-muted-foreground">{profile.email}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              🎓 {collegeName}
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Joined {format(new Date(profile.created_at), "MMMM d, yyyy")}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border bg-muted/50 p-4 text-center">
                <s.icon className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
