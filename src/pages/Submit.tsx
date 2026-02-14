import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";

export default function Submit() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [courseraLink, setCourseraLink] = useState("");
  const [linkedinLink, setLinkedinLink] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    if (!courseraLink.includes("coursera.org")) {
      toast.error("Please enter a valid Coursera link");
      return;
    }
    if (!linkedinLink.includes("linkedin.com")) {
      toast.error("Please enter a valid LinkedIn link");
      return;
    }

    setLoading(true);
    try {
      // Insert submission
      const { data: submission, error } = await supabase.from("submissions").insert({
        user_id: user.id,
        college_id: profile.college_id,
        coursera_link: courseraLink.trim(),
        linkedin_link: linkedinLink.trim(),
      }).select().single();

      if (error) throw error;

      // Trigger verification
      supabase.functions.invoke("verify-submission", {
        body: { submission_id: submission.id },
      }).catch(console.error); // Fire and forget but it will update DB

      toast.success("Submission received! Verification in progress.");
      setCourseraLink("");
      setLinkedinLink("");
      navigate("/my-submissions");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-lg py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" /> Submit Project
          </CardTitle>
          <CardDescription>
            Paste your Coursera certificate link and LinkedIn post link for verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="coursera">Coursera Certificate Link</Label>
              <Input
                id="coursera"
                value={courseraLink}
                onChange={(e) => setCourseraLink(e.target.value)}
                placeholder="https://www.coursera.org/account/accomplishments/..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedin">LinkedIn Post Link</Label>
              <Input
                id="linkedin"
                value={linkedinLink}
                onChange={(e) => setLinkedinLink(e.target.value)}
                placeholder="https://www.linkedin.com/posts/..."
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : "Submit for Verification"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
