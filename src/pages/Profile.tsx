import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { isHeadAdmin } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Pencil, Save, X, Lock, Eye, EyeOff, LogOut, GraduationCap, IdCard, Linkedin } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import InfoPill from "@/components/profile/InfoPill";
import PasswordStrengthBar from "@/components/profile/PasswordStrengthBar";

export default function Profile() {
  const { profile, profileLoading, refreshProfile, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [collegeName, setCollegeName] = useState("");
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
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
      setFullName(profile.full_name || "");
      setRollNo(profile.roll_no || "");
      setLinkedinUrl(profile.linkedin_url || "");
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, roll_no: rollNo, linkedin_url: linkedinUrl.trim() || null })
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

  // ── Loading state: show skeleton while profile is being fetched ──
  if (profileLoading) {
    return (
      <div className="container max-w-2xl py-10 space-y-6 px-4">
        <Card className="overflow-hidden border-t-2 border-t-primary shadow-sm">
          <div className="relative h-32 bg-muted animate-pulse" />
          <CardHeader className="pt-14 pb-2 text-center space-y-3">
            <div className="flex justify-center">
              <div className="h-20 w-20 rounded-full bg-muted animate-pulse -mt-24 ring-4 ring-background" />
            </div>
            <div className="space-y-2 flex flex-col items-center">
              <div className="h-7 w-48 bg-muted animate-pulse rounded" />
              <div className="h-4 w-56 bg-muted animate-pulse rounded" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <div className="h-8 w-32 bg-muted animate-pulse rounded-full" />
              <div className="h-8 w-40 bg-muted animate-pulse rounded-full" />
              <div className="h-8 w-36 bg-muted animate-pulse rounded-full" />
            </div>
            <div className="h-10 w-full bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <div className="h-6 w-44 bg-muted animate-pulse rounded" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-10 w-full bg-muted animate-pulse rounded" />
            <div className="h-10 w-full bg-muted animate-pulse rounded" />
            <div className="h-10 w-full bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Empty state: no profile row exists for this user ──
  if (!profile) {
    return (
      <div className="container max-w-2xl py-10 space-y-6 px-4">
        <Card className="overflow-hidden border-t-2 border-t-primary shadow-sm">
          <div
            className="relative h-32"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)/0.5), hsl(var(--primary)/0.25), transparent)",
            }}
          />
          <CardHeader className="pt-8 pb-2 text-center">
            <CardTitle className="text-2xl">Welcome!</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {user?.email ?? "Your account is set up."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 space-y-3">
              <p className="text-muted-foreground text-sm">
                Your profile hasn't been created yet. This can happen if signup was interrupted.
              </p>
              <p className="text-muted-foreground text-sm">
                Please contact an administrator or try signing out and signing up again.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2 text-muted-foreground transition-all hover:bg-destructive/20 hover:text-destructive hover:border-destructive/50"
              onClick={async () => { await signOut(); navigate("/"); }}
            >
              <LogOut className="h-4 w-4" /> Logout & Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get initials for avatar (null-safe)
  const initials = (profile.full_name || "?")
    .split(" ")
    .map((n: string) => n[0] || "")
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

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
              <div className="space-y-2">
                <Label htmlFor="edit-linkedin" className="text-xs uppercase tracking-wider text-muted-foreground">LinkedIn Profile URL</Label>
                <Input
                  id="edit-linkedin"
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="linkedin.com/in/your-name"
                  className="transition-all focus:shadow-sm"
                />
                <p className="text-xs text-muted-foreground">Used to verify post ownership during project submissions.</p>
              </div>
              <div className="flex gap-2 pt-1">
                <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5 transition-all">
                  <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setEditing(false); setFullName(profile.full_name); setRollNo(profile.roll_no || ""); setLinkedinUrl(profile.linkedin_url || ""); }}
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
              {profile.linkedin_url && (
                <a
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-sm text-foreground hover:bg-primary/10 hover:border-primary/40 transition-colors"
                >
                  <Linkedin className="h-3.5 w-3.5 text-[#0A66C2]" />
                  LinkedIn
                </a>
              )}
              {!profile.linkedin_url && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 rounded-full border border-dashed border-border bg-muted/50 px-3 py-1 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                >
                  <Linkedin className="h-3.5 w-3.5" />
                  Add LinkedIn URL
                </button>
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