import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { THAPAR_COLLEGE_ID, isHeadAdmin as checkHeadAdmin } from "@/lib/constants";
import type { User, Session } from "@supabase/supabase-js";

type Profile = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  college_id: string;
  roll_no: string | null;
  linkedin_url: string | null;
  score: number;
  total_submissions: number;
  correct_submissions: number;
  created_at: string;
};

type SignUpResult = { error: string | null; rateLimited?: boolean };

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isHeadAdmin: boolean;
  loading: boolean;
  profileLoading: boolean;
  signUp: (email: string, password: string, fullName: string, collegeId: string, rollNo: string, linkedinUrl?: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  const checkAdminStatus = async (userId: string) => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin");
    setIsAdmin(roles && roles.length > 0 ? true : false);
  };

  const fetchProfile = async (userId: string, userEmail?: string) => {
    setProfileLoading(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (data) {
        setProfile(data);
      } else {
        // Auto-heal: create missing profile row for authenticated user
        const email = userEmail || "";
        const { error: insertErr } = await supabase.from("profiles").insert({
          user_id: userId,
          full_name: email.split("@")[0] || "New User",
          email,
          college_id: THAPAR_COLLEGE_ID,
        });

        if (!insertErr) {
          // Re-fetch the newly created profile
          const { data: newProfile } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();
          setProfile(newProfile);
        } else {
          // Insert failed (e.g. RLS or duplicate) — set null, UI will handle
          setProfile(null);
        }
      }
      await checkAdminStatus(userId);
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id, user.email ?? undefined);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id, session.user.email ?? undefined), 0);
        } else {
          setProfile(null);
          setProfileLoading(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email ?? undefined);
      } else {
        setProfileLoading(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, collegeId: string, rollNo: string, linkedinUrl?: string): Promise<SignUpResult> => {
    // Validate @thapar.edu
    if (!email.endsWith("@thapar.edu")) {
      return { error: "Only @thapar.edu email addresses are allowed" };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });

    if (error) {
      // Detect 429 rate-limit errors from Supabase
      const isRateLimited =
        error.status === 429 ||
        error.message?.toLowerCase().includes("rate limit") ||
        error.message?.toLowerCase().includes("too many requests");

      if (isRateLimited) {
        return {
          error: "Too many attempts. Please wait a few minutes before trying again.",
          rateLimited: true,
        };
      }
      return { error: error.message };
    }

    if (data.user) {
      const { error: profileErr } = await supabase.from("profiles").insert({
        user_id: data.user.id,
        full_name: fullName,
        email,
        college_id: collegeId,
        roll_no: rollNo,
        linkedin_url: linkedinUrl || null,
      });
      if (profileErr) return { error: profileErr.message };
    }
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    if (!email.endsWith("@thapar.edu")) {
      return { error: "Only @thapar.edu email addresses are allowed" };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const verifyOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup'
    });
    return { error: error?.message ?? null };
  };

  const resetPassword = async (email: string) => {
    if (!email.endsWith("@thapar.edu")) {
      return { error: "Only @thapar.edu email addresses are allowed" };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      isAdmin, 
      isHeadAdmin: checkHeadAdmin(user?.email),
      loading, 
      profileLoading, 
      signUp, 
      signIn, 
      signOut, 
      refreshProfile, 
      verifyOtp, 
      resetPassword, 
      updatePassword 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
