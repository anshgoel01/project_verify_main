import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const THAPAR_COLLEGE_ID = "d8958a90-d06a-467e-818d-64277f84f5c3";

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [role, setRole] = useState<"student" | "admin">("student");
  const [loading, setLoading] = useState(false);
  const { user, signUp, signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/submit");
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validate @thapar.edu email
    if (!email.endsWith("@thapar.edu")) {
      toast.error("Only @thapar.edu email addresses are allowed");
      setLoading(false);
      return;
    }

    if (isSignUp) {
      if (!fullName || !rollNo) {
        toast.error("Please fill in all fields");
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, fullName, THAPAR_COLLEGE_ID, rollNo);
      if (error) {
        toast.error(error);
      } else {
        toast.success("Account created! Please check your email to verify.");

        // If they selected admin role, create an admin request
        if (role === "admin") {
          // We need to wait a bit for the user to be created
          const { data: authData } = await supabase.auth.getUser();
          if (authData?.user) {
            await supabase.from("admin_requests" as any).insert({
              user_id: authData.user.id,
            });
            toast.info("Your admin request has been submitted and is pending approval.");
          }
        }
      }
    } else {
      // Sign in flow
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error);
        setLoading(false);
        return;
      }

      // If logging in as admin, check if they have admin role
      if (role === "admin") {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", authData.user.id)
            .eq("role", "admin");

          if (!roles || roles.length === 0) {
            // Check if they have a pending request
            const { data: requests } = await (supabase
              .from("admin_requests" as any)
              .select("status")
              .eq("user_id", authData.user.id)
              .single() as any);

            if (requests?.status === "pending") {
              toast.info("Your admin request is still pending approval.");
            } else if (requests?.status === "rejected") {
              toast.error("Your admin request was rejected.");
            } else {
              // Create a new request
              await supabase.from("admin_requests" as any).insert({
                user_id: authData.user.id,
              });
              toast.info("Admin access requested. Please wait for approval.");
            }
          }
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{isSignUp ? "Create Account" : "Welcome Back"}</CardTitle>
          <CardDescription>
            {isSignUp ? "Sign up with your @thapar.edu email" : "Sign in to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rollno">Roll Number</Label>
                  <Input id="rollno" value={rollNo} onChange={(e) => setRollNo(e.target.value)} required placeholder="e.g. 2024CS001" />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email (@thapar.edu only)</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@thapar.edu" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
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
              {role === "admin" && (
                <p className="text-xs text-muted-foreground">
                  Admin access requires approval. You'll be notified once approved.
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Sign In"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button className="text-primary underline" onClick={() => setIsSignUp(!isSignUp)}>
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
