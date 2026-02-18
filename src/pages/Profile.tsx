import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

const HEAD_ADMIN_EMAIL = "agoel2_be23@thapar.edu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Trophy, CheckCircle, Send, Calendar, Pencil, Save, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function Profile() {
  const { profile, refreshProfile } = useAuth();
  const [collegeName, setCollegeName] = useState("");
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.college_id) {
      supabase.from("colleges").select("name").eq("id", profile.college_id).single().then(({ data }) => {
        if (data) setCollegeName(data.name);
      });
    }
    if (profile) {
      setFullName(profile.full_name);
      setRollNo((profile as any).roll_no || "");
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, roll_no: rollNo } as any)
      .eq("user_id", profile.user_id);
    if (error) {
      toast.error("Failed to update profile");
    } else {
      toast.success("Profile updated!");
      await refreshProfile();
      setEditing(false);
    }
    setSaving(false);
  };

  const [isAdmin, setIsAdmin] = useState(false);
  const isHeadAdmin = profile?.email === HEAD_ADMIN_EMAIL;

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.user_id)
      .eq("role", "admin" as any)
      .then(({ data }: any) => {
        setIsAdmin(data && data.length > 0);
      });
  }, [profile]);

  if (!profile) return null;

  // Hide submission stats for regular admins (not head admin)
  const showStats = !isAdmin || isHeadAdmin;

  const stats = [
    { icon: Send, label: "Total Submissions", value: profile.total_submissions },
    { icon: CheckCircle, label: "Correct", value: profile.correct_submissions },
    { icon: Trophy, label: "Score", value: profile.score },
  ];

  return (
    <div className="container max-w-2xl py-10">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Profile
          </CardTitle>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input id="edit-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-roll">Roll Number</Label>
                <Input id="edit-roll" value={rollNo} onChange={(e) => setRollNo(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                  <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
                </Button>
                <Button variant="outline" onClick={() => { setEditing(false); setFullName(profile.full_name); setRollNo((profile as any).roll_no || ""); }} className="gap-1.5">
                  <X className="h-4 w-4" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-2xl font-bold">{profile.full_name}</p>
              <p className="text-muted-foreground">{profile.email}</p>
              {(profile as any).roll_no && (
                <p className="text-sm text-muted-foreground">Roll No: {(profile as any).roll_no}</p>
              )}
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                🎓 {collegeName}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Joined {format(new Date(profile.created_at), "MMMM d, yyyy")}
              </p>
            </div>
          )}

          {showStats && (
            <div className="grid grid-cols-3 gap-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-lg border bg-muted/50 p-4 text-center">
                  <s.icon className="h-5 w-5 mx-auto text-primary mb-1" />
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// import { useEffect, useState } from "react";
// import { useAuth } from "@/lib/auth";
// import { supabase } from "@/integrations/supabase/client";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { User, Trophy, CheckCircle, Send, Calendar, Pencil, Save, X } from "lucide-react";
// import { format } from "date-fns";
// import { toast } from "sonner";

// export default function Profile() {
//   const { profile, refreshProfile } = useAuth();
//   const [collegeName, setCollegeName] = useState("");
//   const [editing, setEditing] = useState(false);
//   const [fullName, setFullName] = useState("");
//   const [rollNo, setRollNo] = useState("");
//   const [saving, setSaving] = useState(false);

//   useEffect(() => {
//     if (profile?.college_id) {
//       supabase.from("colleges").select("name").eq("id", profile.college_id).single().then(({ data }) => {
//         if (data) setCollegeName(data.name);
//       });
//     }
//     if (profile) {
//       setFullName(profile.full_name);
//       setRollNo((profile as any).roll_no || "");
//     }
//   }, [profile]);

//   const handleSave = async () => {
//     if (!profile) return;
//     setSaving(true);
//     const { error } = await supabase
//       .from("profiles")
//       .update({ full_name: fullName, roll_no: rollNo } as any)
//       .eq("user_id", profile.user_id);
//     if (error) {
//       toast.error("Failed to update profile");
//     } else {
//       toast.success("Profile updated!");
//       await refreshProfile();
//       setEditing(false);
//     }
//     setSaving(false);
//   };

//   if (!profile) return null;

//   const stats = [
//     { icon: Send, label: "Total Submissions", value: profile.total_submissions },
//     { icon: CheckCircle, label: "Correct", value: profile.correct_submissions },
//     { icon: Trophy, label: "Score", value: profile.score },
//   ];

//   return (
//     <div className="container max-w-2xl py-10">
//       <Card>
//         <CardHeader className="flex flex-row items-center justify-between">
//           <CardTitle className="flex items-center gap-2">
//             <User className="h-5 w-5" /> Profile
//           </CardTitle>
//           {!editing && (
//             <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
//               <Pencil className="h-4 w-4" /> Edit
//             </Button>
//           )}
//         </CardHeader>
//         <CardContent className="space-y-6">
//           {editing ? (
//             <div className="space-y-4">
//               <div className="space-y-2">
//                 <Label htmlFor="edit-name">Full Name</Label>
//                 <Input id="edit-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
//               </div>
//               <div className="space-y-2">
//                 <Label htmlFor="edit-roll">Roll Number</Label>
//                 <Input id="edit-roll" value={rollNo} onChange={(e) => setRollNo(e.target.value)} />
//               </div>
//               <div className="flex gap-2">
//                 <Button onClick={handleSave} disabled={saving} className="gap-1.5">
//                   <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
//                 </Button>
//                 <Button variant="outline" onClick={() => { setEditing(false); setFullName(profile.full_name); setRollNo((profile as any).roll_no || ""); }} className="gap-1.5">
//                   <X className="h-4 w-4" /> Cancel
//                 </Button>
//               </div>
//             </div>
//           ) : (
//             <div className="space-y-2">
//               <p className="text-2xl font-bold">{profile.full_name}</p>
//               <p className="text-muted-foreground">{profile.email}</p>
//               {(profile as any).roll_no && (
//                 <p className="text-sm text-muted-foreground">Roll No: {(profile as any).roll_no}</p>
//               )}
//               <p className="text-sm text-muted-foreground flex items-center gap-1.5">
//                 🎓 {collegeName}
//               </p>
//               <p className="text-sm text-muted-foreground flex items-center gap-1.5">
//                 <Calendar className="h-3.5 w-3.5" />
//                 Joined {format(new Date(profile.created_at), "MMMM d, yyyy")}
//               </p>
//             </div>
//           )}

//           <div className="grid grid-cols-3 gap-4">
//             {stats.map((s) => (
//               <div key={s.label} className="rounded-lg border bg-muted/50 p-4 text-center">
//                 <s.icon className="h-5 w-5 mx-auto text-primary mb-1" />
//                 <p className="text-2xl font-bold">{s.value}</p>
//                 <p className="text-xs text-muted-foreground">{s.label}</p>
//               </div>
//             ))}
//           </div>
//         </CardContent>
//       </Card>
//     </div>
//   );
// }

// import { useEffect, useState } from "react";
// import { useAuth } from "@/lib/auth";
// import { supabase } from "@/integrations/supabase/client";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { User, Trophy, CheckCircle, Send, Calendar } from "lucide-react";
// import { format } from "date-fns";

// export default function Profile() {
//   const { profile } = useAuth();
//   const [collegeName, setCollegeName] = useState("");

//   useEffect(() => {
//     if (profile?.college_id) {
//       supabase.from("colleges").select("name").eq("id", profile.college_id).single().then(({ data }) => {
//         if (data) setCollegeName(data.name);
//       });
//     }
//   }, [profile]);

//   if (!profile) return null;

//   const stats = [
//     { icon: Send, label: "Total Submissions", value: profile.total_submissions },
//     { icon: CheckCircle, label: "Correct", value: profile.correct_submissions },
//     { icon: Trophy, label: "Score", value: profile.score },
//   ];

//   return (
//     <div className="container max-w-2xl py-10">
//       <Card>
//         <CardHeader>
//           <CardTitle className="flex items-center gap-2">
//             <User className="h-5 w-5" /> Profile
//           </CardTitle>
//         </CardHeader>
//         <CardContent className="space-y-6">
//           <div className="space-y-2">
//             <p className="text-2xl font-bold">{profile.full_name}</p>
//             <p className="text-muted-foreground">{profile.email}</p>
//             <p className="text-sm text-muted-foreground flex items-center gap-1.5">
//               🎓 {collegeName}
//             </p>
//             <p className="text-sm text-muted-foreground flex items-center gap-1.5">
//               <Calendar className="h-3.5 w-3.5" />
//               Joined {format(new Date(profile.created_at), "MMMM d, yyyy")}
//             </p>
//           </div>

//           <div className="grid grid-cols-3 gap-4">
//             {stats.map((s) => (
//               <div key={s.label} className="rounded-lg border bg-muted/50 p-4 text-center">
//                 <s.icon className="h-5 w-5 mx-auto text-primary mb-1" />
//                 <p className="text-2xl font-bold">{s.value}</p>
//                 <p className="text-xs text-muted-foreground">{s.label}</p>
//               </div>
//             ))}
//           </div>
//         </CardContent>
//       </Card>
//     </div>
//   );
// }
