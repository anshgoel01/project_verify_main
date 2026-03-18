// import { useEffect, useState } from "react";
// import { useAuth } from "@/lib/auth";
// import { supabase } from "@/integrations/supabase/client";
// import { isHeadAdmin } from "@/lib/constants";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { User, Trophy, CheckCircle, Send, Calendar, Pencil, Save, X, Lock, Eye, EyeOff, LogOut } from "lucide-react";
// import { format } from "date-fns";
// import { toast } from "sonner";
// import { useNavigate } from "react-router-dom";

// export default function Profile() {
//   const { profile, refreshProfile, signOut } = useAuth();
//   const navigate = useNavigate();
//   const [collegeName, setCollegeName] = useState("");
//   const [editing, setEditing] = useState(false);
//   const [fullName, setFullName] = useState("");
//   const [rollNo, setRollNo] = useState("");
//   const [saving, setSaving] = useState(false);
//   const [newPassword, setNewPassword] = useState("");
//   const [confirmPassword, setConfirmPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [updatingPassword, setUpdatingPassword] = useState(false);

//   useEffect(() => {
//     if (profile?.college_id) {
//       supabase.from("colleges").select("name").eq("id", profile.college_id).single().then(({ data }) => {
//         if (data) setCollegeName(data.name);
//       });
//     }
//     if (profile) {
//       setFullName(profile.full_name);
//       setRollNo(profile.roll_no || "");
//     }
//   }, [profile]);

//   const handleSave = async () => {
//     if (!profile) return;
//     setSaving(true);
//     const { error } = await supabase
//       .from("profiles")
//       .update({ full_name: fullName, roll_no: rollNo })
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

//   const [isAdmin, setIsAdmin] = useState(false);
//   const headAdmin = isHeadAdmin(profile?.email);

//   useEffect(() => {
//     if (!profile) return;
//     supabase
//       .from("user_roles")
//       .select("role")
//       .eq("user_id", profile.user_id)
//       .eq("role", "admin")
//       .then(({ data }) => {
//         setIsAdmin(data && data.length > 0);
//       });
//   }, [profile]);

//   if (!profile) return null;

//   const showStats = !isAdmin || headAdmin;

//   const stats = [
//     { icon: Send, label: "Total Submissions", value: profile.total_submissions },
//    { icon: CheckCircle, label: "Correct", value: profile.correct_submissions },
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
//                 <Button variant="outline" onClick={() => { setEditing(false); setFullName(profile.full_name); setRollNo(profile.roll_no || ""); }} className="gap-1.5">
//                   <X className="h-4 w-4" /> Cancel
//                 </Button>
//               </div>
//             </div>
//           ) : (
//             <div className="space-y-2">
//               <p className="text-2xl font-bold">{profile.full_name}</p>
//               <p className="text-muted-foreground">{profile.email}</p>
//               {profile.roll_no && (
//                 <p className="text-sm text-muted-foreground">Roll No: {profile.roll_no}</p>
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

//           {showStats && (
//             <div className="grid grid-cols-2 gap-4">
//               {stats.map((s) => (
//                 <div key={s.label} className="rounded-lg border bg-muted/50 p-4 text-center">
//                   <s.icon className="h-5 w-5 mx-auto text-primary mb-1" />
//                   <p className="text-2xl font-bold">{s.value}</p>
//                   <p className="text-xs text-muted-foreground">{s.label}</p>
//                 </div>
//               ))}
//             </div>
//           )}

//           <Button
//             variant="outline"
//             className="w-full gap-2 text-muted-foreground hover:text-destructive hover:border-destructive"
//             onClick={async () => { await signOut(); navigate("/"); }}
//           >
//             <LogOut className="h-4 w-4" /> Logout
//           </Button>
//         </CardContent>
//       </Card>

//       {/* Change Password Card */}
//       <Card className="mt-6">
//         <CardHeader>
//           <CardTitle className="flex items-center gap-2">
//             <Lock className="h-5 w-5" /> Change Password
//           </CardTitle>
//         </CardHeader>
//         <CardContent className="space-y-4">
//           <div className="space-y-2">
//             <Label htmlFor="new-password">New Password</Label>
//             <div className="relative">
//               <Input
//                 id="new-password"
//                 type={showPassword ? "text" : "password"}
//                 value={newPassword}
//                 onChange={(e) => setNewPassword(e.target.value)}
//                 placeholder="Minimum 6 characters"
//               />
//               <button
//                 type="button"
//                 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
//                 onClick={() => setShowPassword(!showPassword)}
//               >
//                 {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
//               </button>
//             </div>
//           </div>
//           <div className="space-y-2">
//             <Label htmlFor="confirm-password">Confirm New Password</Label>
//             <Input
//               id="confirm-password"
//               type={showPassword ? "text" : "password"}
//               value={confirmPassword}
//               onChange={(e) => setConfirmPassword(e.target.value)}
//               placeholder="Confirm your new password"
//             />
//           </div>
//           <Button
//             className="w-full gap-2"
//             disabled={updatingPassword || !newPassword || !confirmPassword}
//             onClick={async () => {
//               if (newPassword !== confirmPassword) {
//                 toast.error("Passwords do not match");
//                 return;
//               }
//               if (newPassword.length < 6) {
//                 toast.error("Password must be at least 6 characters");
//                 return;
//               }
//               setUpdatingPassword(true);
//               const { error } = await supabase.auth.updateUser({ password: newPassword });
//               if (error) {
//                 toast.error(error.message);
//               } else {
//                 toast.success("Password updated successfully!");
//                 setNewPassword("");
//                 setConfirmPassword("");
//               }
//               setUpdatingPassword(false);
//             }}
//           >
//             {updatingPassword ? "Updating..." : "Update Password"}
//           </Button>
//         </CardContent>
//       </Card>
//     </div>
//   );
// }


import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { isHeadAdmin } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Pencil, Save, X, Lock, Eye, EyeOff, LogOut, GraduationCap, IdCard } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import InfoPill from "@/components/profile/InfoPill";
import PasswordStrengthBar from "@/components/profile/PasswordStrengthBar";

export default function Profile() {
  const { profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [collegeName, setCollegeName] = useState("");
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    if (profile?.college_id) {
      supabase.from("colleges").select("name").eq("id", profile.college_id).single().then(({ data }) => {
        if (data) setCollegeName(data.name);
      });
    }
    if (profile) {
      setFullName(profile.full_name);
      setRollNo(profile.roll_no || "");
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, roll_no: rollNo })
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

  useEffect(() => {
    if (!profile) return;
    (supabase
      .from("user_roles" as any)
      .select("role")
      .eq("user_id", profile.user_id)
      .eq("role", "admin") as any)
      .then(({ data }: any) => {
        setIsAdmin(data && data.length > 0);
      });
  }, [profile]);

  if (!profile) return null;

  // Get initials for avatar
  const initials = profile.full_name
    .split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="container max-w-2xl py-10 space-y-6 px-4">
      {/* Profile Card */}
      <Card className="overflow-hidden border-t-2 border-t-primary shadow-sm transition-shadow hover:shadow-md">

        {/* ── Banner with primary gradient + diagonal texture ── */}
        <div className="relative h-32"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary)/0.5), hsl(var(--primary)/0.25), transparent)",
            backgroundImage: `
              linear-gradient(135deg, hsl(var(--primary)/0.5), hsl(var(--primary)/0.25), transparent),
              repeating-linear-gradient(
                45deg,
                hsl(var(--primary)/0.04) 0px,
                hsl(var(--primary)/0.04) 1px,
                transparent 1px,
                transparent 8px
              )
            `,
          }}
        >
          {/* ── Avatar overlapping banner ── */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-10">
            <div className="h-20 w-20 rounded-full bg-primary ring-4 ring-background shadow-xl flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-foreground">{initials}</span>
            </div>
          </div>
        </div>

        <CardHeader className="pt-14 pb-2 text-center">
          <div className="flex items-center justify-center gap-2">
            <CardTitle className="text-2xl">{profile.full_name}</CardTitle>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </CardHeader>

        <CardContent className="space-y-6">
          {editing ? (
            <div className="rounded-lg border border-border bg-muted/30 p-5 space-y-4 transition-all">
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-xs uppercase tracking-wider text-muted-foreground">Full Name</Label>
                <Input id="edit-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="transition-all focus:shadow-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-roll" className="text-xs uppercase tracking-wider text-muted-foreground">Roll Number</Label>
                <Input id="edit-roll" value={rollNo} onChange={(e) => setRollNo(e.target.value)} className="transition-all focus:shadow-sm" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5 transition-all">
                  <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setEditing(false); setFullName(profile.full_name); setRollNo(profile.roll_no || ""); }}
                  className="gap-1.5 transition-colors"
                >
                  <X className="h-4 w-4" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            // ── Info Pills — explicit border + bg for dark mode ──
            <div className="flex flex-wrap items-center justify-center gap-2">
              {profile.roll_no && (
                <span className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-sm text-foreground">
                  <IdCard className="h-3.5 w-3.5 text-muted-foreground" />
                  Roll No: {profile.roll_no}
                </span>
              )}
              {collegeName && (
                <span className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-sm text-foreground">
                  <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                  {collegeName}
                </span>
              )}
              <span className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-sm text-foreground">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Joined {format(new Date(profile.created_at), "MMM d, yyyy")}
              </span>
            </div>
          )}

          {/* ── Logout — outline variant, red on hover ── */}
          <Button
            variant="outline"
            className="w-full gap-2 text-muted-foreground transition-all hover:bg-destructive/20 hover:text-destructive hover:border-destructive/50"
            onClick={async () => { await signOut(); navigate("/"); }}
          >
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </CardContent>
      </Card>

      {/* ── Change Password Card — lock icon in header, not absolute ── */}
      <Card className="border shadow-sm bg-card transition-shadow hover:shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-xs uppercase tracking-wider text-muted-foreground">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="pr-10 transition-all focus:shadow-sm"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PasswordStrengthBar password={newPassword} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-xs uppercase tracking-wider text-muted-foreground">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
              className="transition-all focus:shadow-sm"
            />
          </div>
          <Button
            className="w-full gap-2 transition-all"
            disabled={updatingPassword || !newPassword || !confirmPassword}
            onClick={async () => {
              if (newPassword !== confirmPassword) {
                toast.error("Passwords do not match");
                return;
              }
              if (newPassword.length < 6) {
                toast.error("Password must be at least 6 characters");
                return;
              }
              setUpdatingPassword(true);
              const { error } = await supabase.auth.updateUser({ password: newPassword });
              if (error) {
                toast.error(error.message);
              } else {
                toast.success("Password updated successfully!");
                setNewPassword("");
                setConfirmPassword("");
              }
              setUpdatingPassword(false);
            }}
          >
            {updatingPassword ? "Updating..." : "Update Password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}