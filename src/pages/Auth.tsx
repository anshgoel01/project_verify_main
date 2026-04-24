import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { THAPAR_COLLEGE_ID } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await resetPassword(email);
    if (error) {
      toast.error(error);
    } else {
      setSent(true);
      toast.success("Password reset email sent! Check your inbox.");
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <div className="text-4xl">📧</div>
        <p className="text-sm text-muted-foreground">
          We've sent a password reset link to <strong>{email}</strong>.
          Check your inbox and click the link to reset your password.
        </p>
        <Button variant="outline" className="w-full" onClick={onBack}>
          Back to Sign In
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reset-email">Email (@thapar.edu only)</Label>
        <Input
          id="reset-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@thapar.edu"
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Sending..." : "Send Reset Link"}
      </Button>
      <div className="text-center">
        <button type="button" className="text-sm text-primary underline" onClick={onBack}>
          Back to Sign In
        </button>
      </div>
    </form>
  );
}

function AuthForm({
  isSignUp, setIsSignUp, showForgot, setShowForgot,
}: {
  isSignUp: boolean;
  setIsSignUp: (v: boolean) => void;
  showForgot: boolean;
  setShowForgot: (v: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [role, setRole] = useState<"student" | "admin">("student");
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { signUp, signIn, verifyOtp } = useAuth();
  const navigate = useNavigate();

  // Cleanup cooldown timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = (seconds: number) => {
    setCooldownSeconds(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const isButtonDisabled = loading || cooldownSeconds > 0;

  const getButtonLabel = () => {
    if (cooldownSeconds > 0) return `Please wait (${cooldownSeconds}s)`;
    if (loading) return "Please wait...";
    return isSignUp ? "Sign Up" : "Sign In";
  };

  const isSubmitting = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Synchronous ref guard — blocks re-entry before React re-renders
    if (isSubmitting.current) return;
    // Also block if in cooldown
    if (cooldownSeconds > 0) return;

    isSubmitting.current = true;
    setLoading(true);

    try {
      if (!email.endsWith("@thapar.edu")) {
        toast.error("Only @thapar.edu email addresses are allowed");
        return;
      }
      if (isSignUp) {
        if (!fullName || !rollNo) {
          toast.error("Please fill in all fields");
          return;
        }
        if (linkedinUrl && !linkedinUrl.includes("linkedin.com/in/")) {
          toast.error("LinkedIn URL must be a profile link (linkedin.com/in/your-name)");
          return;
        }
        // Start cooldown BEFORE the API call to prevent any concurrent requests
        startCooldown(60);
        const result = await signUp(email, password, fullName, THAPAR_COLLEGE_ID, rollNo, linkedinUrl.trim() || undefined);
        if (result.error) {
          toast.error(result.error);
          // Keep cooldown running on rate-limit; clear it on other errors
          if (!result.rateLimited) {
            // Clear the pre-emptive cooldown since it wasn't a rate-limit error
            setCooldownSeconds(0);
            if (cooldownRef.current) {
              clearInterval(cooldownRef.current);
              cooldownRef.current = null;
            }
          }
        } else {
          // Success — clear the pre-emptive cooldown
          setCooldownSeconds(0);
          if (cooldownRef.current) {
            clearInterval(cooldownRef.current);
            cooldownRef.current = null;
          }
          setIsVerifying(true);
          toast.success("Signup successful! Please enter the OTP sent to your email.");
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) { toast.error(error); return; }
        if (role === "admin") {
          const { data: authData } = await supabase.auth.getUser();
          if (authData?.user) {
            const { data: roles } = await (supabase.from("user_roles" as any).select("role").eq("user_id", authData.user.id).eq("role", "admin") as any);
            if (!roles || roles.length === 0) {
              const { data: requests } = await (supabase.from("admin_requests" as any).select("status").eq("user_id", authData.user.id).maybeSingle() as any);
              if (requests?.status === "pending") { toast.info("Your admin request is still pending approval."); }
              else if (requests?.status === "rejected") { toast.error("Your admin request was rejected."); }
              else {
                await (supabase.from("admin_requests" as any) as any).insert({ user_id: authData.user.id });
                toast.info("Admin access requested. Please wait for approval.");
              }
            }
          }
        }
      }
    } finally {
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  if (showForgot) return <ForgotPasswordForm onBack={() => setShowForgot(false)} />;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={isSignUp ? "signup" : "signin"}
        initial={{ opacity: 0, x: isSignUp ? 20 : -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: isSignUp ? -20 : 20 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rollno">Roll Number</Label>
                <Input id="rollno" value={rollNo} onChange={(e) => setRollNo(e.target.value)} required placeholder="e.g. 1023...." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedin-url">LinkedIn Profile URL</Label>
                <Input
                  id="linkedin-url"
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="linkedin.com/in/your-name"
                />
                <p className="text-xs text-muted-foreground">Used to verify LinkedIn post ownership during submissions.</p>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email (@thapar.edu only)</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@thapar.edu" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {!isSignUp && (
                <button type="button" className="text-xs text-primary underline hover:opacity-80" onClick={() => setShowForgot(true)}>
                  Forgot password?
                </button>
              )}
            </div>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
          </div>
          <div className="space-y-2">
            <Label>Login as</Label>
            <RadioGroup value={role} onValueChange={(v) => setRole(v as "student" | "admin")} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="student" id="student" />
                <Label htmlFor="student" className="cursor-pointer">Student</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="admin" id="admin" />
                <Label htmlFor="admin" className="cursor-pointer">Admin</Label>
              </div>
            </RadioGroup>
            {role === "admin" && <p className="text-xs text-muted-foreground">Admin access requires approval. You'll be notified once approved.</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isButtonDisabled}>
            {getButtonLabel()}
          </Button>
        </form>

        {isSignUp && isVerifying && (
          <div className="mt-6 space-y-4 border-t pt-6">
            <div className="space-y-2 text-center">
              <Label htmlFor="otp">Enter Verification Code</Label>
              <div className="flex gap-2">
                <Input id="otp" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="Enter 6-digit code" className="text-center tracking-widest text-lg font-bold" />
                <Button onClick={async () => {
                  setLoading(true);
                  const { error } = await verifyOtp(email, otpCode);
                  if (error) { toast.error(error); } else {
                    toast.success("Email verified successfully!");
                    if (role === "admin") {
                      const { data: authData } = await supabase.auth.getUser();
                      if (authData?.user) {
                        await (supabase.from("admin_requests" as any) as any).insert({ user_id: authData.user.id });
                        toast.info("Your admin request has been submitted and is pending approval.");
                      }
                    }
                    navigate("/");
                  }
                  setLoading(false);
                }} disabled={loading || otpCode.length < 6}>Verify</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Check your @thapar.edu email for the verification code.</p>
            </div>
          </div>
        )}
        <div className="mt-4 text-center text-sm">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button className="text-primary underline" onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { if (user) navigate("/"); }, [user, navigate]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{showForgot ? "Reset Password" : isSignUp ? "Create Account" : "Welcome Back"}</CardTitle>
          <CardDescription>
            {showForgot ? "Enter your @thapar.edu email to receive a reset link" : isSignUp ? "Sign up with your @thapar.edu email" : "Sign in to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm isSignUp={isSignUp} setIsSignUp={setIsSignUp} showForgot={showForgot} setShowForgot={setShowForgot} />
        </CardContent>
      </Card>
    </div>
  );
}
