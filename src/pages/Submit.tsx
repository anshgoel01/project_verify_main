import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Send, Loader2, CheckCircle2, XCircle, ShieldCheck, Info, AlertTriangle, Linkedin, Mail } from "lucide-react";

const submissionSchema = z.object({
  courseraLink: z.string()
    .url("Invalid URL format")
    .includes("coursera.org/account/accomplishments/verify/", { message: "Must be a valid Coursera verification link" }),
  linkedinLink: z.string()
    .url("Invalid URL format")
    .includes("linkedin.com", { message: "Must be a valid LinkedIn link" }),
  projectLink: z.string()
    .url("Invalid URL format")
    .includes("coursera.org/projects/", { message: "Must be a valid Coursera project link" }),
});

type FormErrors = {
  courseraLink?: string;
  linkedinLink?: string;
  projectLink?: string;
};

export default function Submit() {
  const { user, profile, profileLoading } = useAuth();
  const navigate = useNavigate();
  const [courseraLink, setCourseraLink] = useState("");
  const [linkedinLink, setLinkedinLink] = useState("");
  const [projectLink, setProjectLink] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [verifiedSubmissionId, setVerifiedSubmissionId] = useState<string | null>(null);
  const [helpModal, setHelpModal] = useState<{ title: string; image: string } | null>(null);
  const [showLinkedInTip, setShowLinkedInTip] = useState(false);
  const [linkedinFocused, setLinkedinFocused] = useState(false);
  const [allowSubmissions, setAllowSubmissions] = useState(true);

  useEffect(() => {
    supabase
      .from("system_config" as any)
      .select("value")
      .eq("key", "allow_submissions")
      .maybeSingle()
      .then(({ data }: any) => {
        if (data && typeof data.value === "boolean") {
          setAllowSubmissions(data.value);
        }
      });

    const channel = supabase
      .channel("system-config-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "system_config",
          filter: "key=eq.allow_submissions",
        },
        (payload) => {
          if (payload.new && typeof payload.new.value === "boolean") {
            setAllowSubmissions(payload.new.value);
            if (!payload.new.value) {
              toast.error("Submissions are currently disabled by admin.");
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const linksValid =
    courseraLink.includes("coursera.org/account/accomplishments/verify/") &&
    linkedinLink.includes("linkedin.com") &&
    projectLink.includes("coursera.org/projects/");

  const handleVerify = async () => {
    if (!user || !profile) return;

    const validation = submissionSchema.safeParse({
      courseraLink,
      linkedinLink,
      projectLink,
    });

    if (!validation.success) {
      const fieldErrors: FormErrors = {};
      validation.error.errors.forEach((err) => {
        const path = err.path[0] as keyof FormErrors;
        if (!fieldErrors[path]) fieldErrors[path] = err.message;
      });
      setFormErrors(fieldErrors);
      toast.error("Please fix the errors in the form");
      return;
    }

    setVerifying(true);
    setVerifyError("");
    setVerified(false);
    setVerifiedSubmissionId(null);

    try {
      // Check for existing submission of same project (only block if correct or processing)
      const { data: existingByProject } = await supabase
        .from("submissions")
        .select("id, status")
        .eq("user_id", user.id)
        .eq("project_link", projectLink.trim())
        .in("status", ["correct", "processing"])
        .limit(1);

      if (existingByProject && existingByProject.length > 0) {
        const existing = existingByProject[0];
        const statusMsg = existing.status === "correct"
          ? "You've already submitted and verified this project."
          : "Your submission for this project is currently processing.";
        setVerifyError(statusMsg);
        setVerifying(false);
        return;
      }

      // Also check by certificate link (same certificate resubmitted for a different project entry)
      const { data: existingByCert } = await supabase
        .from("submissions")
        .select("id")
        .eq("user_id", user.id)
        .eq("coursera_link", courseraLink.trim())
        .in("status", ["correct", "processing"])
        .limit(1);

      if (existingByCert && existingByCert.length > 0) {
        setVerifyError("This certificate has already been submitted and verified (or is currently processing).");
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

      if (error) {
        // Handle unique constraint violation (PostgreSQL error code 23505)
        if (error.code === "23505") {
          setVerifyError("You've already submitted this project. Duplicate submissions are not allowed.");
          setVerifying(false);
          return;
        }
        throw error;
      }

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

  const handleLinkChange = (setter: (v: string) => void, field: keyof FormErrors, value: string) => {
    setter(value);
    setVerified(false);
    setVerifyError("");
    setVerifiedSubmissionId(null);
    setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleBlur = (field: keyof FormErrors, value: string) => {
    if (!value) return;
    const result = submissionSchema.shape[field].safeParse(value);
    if (!result.success) {
      setFormErrors((prev) => ({ ...prev, [field]: result.error.errors[0].message }));
    }
  };

  return (
    <div className="container max-w-lg py-10">
      {!allowSubmissions && (
        <Alert variant="destructive" className="mb-6 bg-red-500/15 border-red-500/30 text-red-500">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <AlertDescription className="font-medium">
            Submissions are currently disabled by Admin
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" /> Submit Guided Project
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="coursera" className={formErrors.courseraLink ? "text-destructive" : ""}>
                Coursera Certificate Link
              </Label>
              <div className="relative">
                <Input
                  id="coursera"
                  value={courseraLink}
                  onChange={(e) => handleLinkChange(setCourseraLink, "courseraLink", e.target.value)}
                  onBlur={(e) => handleBlur("courseraLink", e.target.value)}
                  placeholder="https://www.coursera.org/account/accomplishments/verify/..."
                  required
                  disabled={verified}
                  className={`pr-9 ${formErrors.courseraLink ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setHelpModal({ title: "Where to find your Coursera Certificate Link", image: "/certificate-help.png" })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              {formErrors.courseraLink && (
                <p className="text-xs font-medium text-destructive flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3" /> {formErrors.courseraLink}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="project" className={formErrors.projectLink ? "text-destructive" : ""}>
                Coursera Project Link
              </Label>
              <div className="relative">
                <Input
                  id="project"
                  value={projectLink}
                  onChange={(e) => handleLinkChange(setProjectLink, "projectLink", e.target.value)}
                  onBlur={(e) => handleBlur("projectLink", e.target.value)}
                  placeholder="https://www.coursera.org/projects/your-project-name"
                  required
                  disabled={verified}
                  className={`pr-9 ${formErrors.projectLink ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setHelpModal({ title: "Where to find your Coursera Project Link", image: "/project-help.png" })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              {formErrors.projectLink && (
                <p className="text-xs font-medium text-destructive flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3" /> {formErrors.projectLink}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedin" className={formErrors.linkedinLink ? "text-destructive" : ""}>
                LinkedIn Post Link
              </Label>
              <div className="relative">
                <Input
                  id="linkedin"
                  value={linkedinLink}
                  onChange={(e) => handleLinkChange(setLinkedinLink, "linkedinLink", e.target.value)}
                  onFocus={() => setLinkedinFocused(true)}
                  onBlur={(e) => {
                    setLinkedinFocused(false);
                    handleBlur("linkedinLink", e.target.value);
                  }}
                  placeholder="https://www.linkedin.com/posts/..."
                  required
                  disabled={verified}
                  className={`pr-9 ${formErrors.linkedinLink ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setHelpModal({ title: "Where to find your LinkedIn Post Link", image: "/linkedin-help.png" })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Info className="h-4 w-4" />
                </button>
                {/* Tooltip on focus */}
                {/* {linkedinFocused && (
                  <div className="absolute left-0 top-full mt-1.5 z-10 w-full rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                    ⚠️ Mention the course name in the <span className="font-semibold">first line</span> of your post (within 200 characters) for automatic verification.
                  </div>
                )} */}
              </div>
              {formErrors.linkedinLink && (
                <p className="text-xs font-medium text-destructive flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3" /> {formErrors.linkedinLink}
                </p>
              )}
              {/* Collapsible how-to section */}
              <button
                type="button"
                onClick={() => setShowLinkedInTip((v) => !v)}
                className="flex items-center gap-1 text-xs text-primary hover:underline focus:outline-none"
              >
                <span>{showLinkedInTip ? "▾" : "▸"}</span>
                How should I write my LinkedIn post?
              </button>
              {showLinkedInTip && (
                <div className="rounded-md border bg-muted/40 px-3 py-2.5 text-xs space-y-1.5 text-muted-foreground">
                  <p className="font-medium text-foreground">For automatic verification, your post must:</p>
                  <p>✅ Mention the <span className="font-medium text-foreground">exact course name in the first line</span> (before any line break)</p>
                  <p>✅ Be a <span className="font-medium text-foreground">public post</span> (not friends-only)</p>
                  <p className="italic border-l-2 border-primary/40 pl-2">
                    Example: "Just completed '<strong>Build a CI/CD Pipeline with Docker</strong>' on Coursera! 🎉 Check it out 👇 #Coursera"
                  </p>
                  <p>❌ Do <span className="font-medium text-foreground">not</span> mention the course name only in comments or deep in the post body</p>
                </div>
              )}
            </div>

            {verifyError && (
              <Alert variant="destructive" className="flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 mt-0.5" />
                  <AlertDescription>{verifyError}</AlertDescription>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full gap-2 bg-destructive-foreground/10 hover:bg-destructive-foreground/20 border-none text-destructive-foreground"
                  onClick={() => window.location.href = "mailto:verifyhubb@gmail.com"}
                >
                  <Mail className="h-4 w-4" />
                  Report an Issue : verifyhubb@gmail.com
                </Button>
              </Alert>
            )}

            {verified && (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <AlertDescription className="font-medium">
                  Verification passed! You can now submit.
                </AlertDescription>
              </Alert>
            )}

            {!profileLoading && !profile?.linkedin_url && (
              <Alert variant="destructive" className="mb-4">
                <Linkedin className="h-4 w-4" />
                <AlertDescription>
                  You haven't added your LinkedIn Profile URL yet. Please go to your <Button variant="link" className="p-0 h-auto text-destructive underline" onClick={() => navigate("/profile")}>Profile</Button> and add it before submitting.
                </AlertDescription>
              </Alert>
            )}

            <div
              className={!allowSubmissions ? "cursor-not-allowed w-full" : "w-full"}
              title={!allowSubmissions ? "Submissions are currently disabled by admin." : undefined}
            >
              {!verified ? (
                <Button
                  type="button"
                  className="w-full"
                  disabled={verifying || !linksValid || !profile?.linkedin_url || !allowSubmissions}
                  onClick={handleVerify}
                >
                  {verifying ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</>
                  ) : (
                    <><ShieldCheck className="h-4 w-4" /> Verify</>
                  )}
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting || !allowSubmissions}
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                  ) : (
                    <><Send className="h-4 w-4" /> Submit</>
                  )}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>



      <Dialog open={!!helpModal} onOpenChange={(open) => !open && setHelpModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{helpModal?.title}</DialogTitle>
          </DialogHeader>
          <img
            src={helpModal?.image}
            alt={helpModal?.title}
            width={800}
            height={450}
            className="w-full rounded-md border aspect-video object-cover bg-muted"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

