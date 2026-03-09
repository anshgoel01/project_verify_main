import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Loader2, CheckCircle2, XCircle, ShieldCheck, Flag } from "lucide-react";
import ReportIssueDialog from "@/components/ReportIssueDialog";

export default function Submit() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [courseraLink, setCourseraLink] = useState("");
  const [linkedinLink, setLinkedinLink] = useState("");
  const [projectLink, setProjectLink] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verifiedSubmissionId, setVerifiedSubmissionId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const linksValid =
    courseraLink.includes("coursera.org") &&
    linkedinLink.includes("linkedin.com") &&
    projectLink.includes("coursera.org");

  const handleVerify = async () => {
    if (!user || !profile) return;

    if (!courseraLink.includes("coursera.org")) {
      toast.error("Please enter a valid Coursera certificate link");
      return;
    }
    if (!linkedinLink.includes("linkedin.com")) {
      toast.error("Please enter a valid LinkedIn link");
      return;
    }
    if (!projectLink.includes("coursera.org")) {
      toast.error("Please enter a valid Coursera project link");
      return;
    }

    setVerifying(true);
    setVerifyError("");
    setVerified(false);
    setVerifiedSubmissionId(null);

    try {
      const { data: existing } = await supabase
        .from("submissions")
        .select("id")
        .eq("user_id", user.id)
        .eq("coursera_link", courseraLink.trim())
        .eq("status", "correct")
        .limit(1);

      if (existing && existing.length > 0) {
        setVerifyError("This course has already been submitted and verified.");
        setVerifying(false);
        return;
      }

      const { data: submission, error } = await supabase
        .from("submissions")
        .insert({
          user_id: user.id,
          college_id: profile.college_id,
          coursera_link: courseraLink.trim(),
          linkedin_link: linkedinLink.trim(),
          project_link: projectLink.trim(),
        } as any)
        .select()
        .single();

      if (error) throw error;

      const { data: result, error: fnError } = await supabase.functions.invoke(
        "verify-submission",
        { body: { submission_id: submission.id } }
      );

      if (fnError) throw fnError;

      if (result?.status === "correct") {
        setVerified(true);
        setVerifiedSubmissionId(submission.id);
        setVerifyError("");
      } else {
        await supabase.from("submissions").delete().eq("id", submission.id);
        setVerifyError(
          result?.error_message || "Verification failed — name on certificate/LinkedIn does not match your profile, or the certificate could not be read. Please check your links and try again."
        );
      }
    } catch (err: any) {
      setVerifyError(err.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verified || !verifiedSubmissionId) return;

    setSubmitting(true);
    try {
      toast.success("Submission confirmed!");
      setCourseraLink("");
      setLinkedinLink("");
      setProjectLink("");
      setVerified(false);
      setVerifiedSubmissionId(null);
      navigate("/my-submissions");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    setVerified(false);
    setVerifyError("");
    setVerifiedSubmissionId(null);
  };

  return (
    <div className="container max-w-lg py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" /> Submit Project
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="coursera">Coursera Certificate Link</Label>
              <Input
                id="coursera"
                value={courseraLink}
                onChange={(e) => handleLinkChange(setCourseraLink, e.target.value)}
                placeholder="https://www.coursera.org/account/accomplishments/..."
                required
                disabled={verified}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project">Coursera Project Link</Label>
              <Input
                id="project"
                value={projectLink}
                onChange={(e) => handleLinkChange(setProjectLink, e.target.value)}
                placeholder="https://www.coursera.org/projects/introduction-data-analysis-microsoft-excel"
                required
                disabled={verified}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedin">LinkedIn Post Link</Label>
              <Input
                id="linkedin"
                value={linkedinLink}
                onChange={(e) => handleLinkChange(setLinkedinLink, e.target.value)}
                placeholder="https://www.linkedin.com/posts/..."
                required
                disabled={verified}
              />
            </div>

            {verifyError && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{verifyError}</AlertDescription>
              </Alert>
            )}

            {verifyError && (
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => setReportOpen(true)}
              >
                <Flag className="h-4 w-4" /> Report an Issue
              </Button>
            )}

            {verified && (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <AlertDescription className="font-medium">
                  Verification passed! You can now submit.
                </AlertDescription>
              </Alert>
            )}

            {!verified ? (
              <Button
                type="button"
                className="w-full"
                disabled={verifying || !linksValid}
                onClick={handleVerify}
              >
                {verifying ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</>
                ) : (
                  <><ShieldCheck className="h-4 w-4" /> Verify</>
                )}
              </Button>
            ) : (
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                ) : (
                  <><Send className="h-4 w-4" /> Submit</>
                )}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <ReportIssueDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        courseraLink={courseraLink}
        linkedinLink={linkedinLink}
        projectLink={projectLink}
      />
    </div>
  );
}
