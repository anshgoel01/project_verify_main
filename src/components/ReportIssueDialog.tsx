import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, Upload, ImageIcon } from "lucide-react";

interface ReportIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseraLink: string;
  linkedinLink: string;
  projectLink: string;
}

export default function ReportIssueDialog({
  open,
  onOpenChange,
  courseraLink,
  linkedinLink,
  projectLink,
}: ReportIssueDialogProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [coursera, setCoursera] = useState(courseraLink);
  const [linkedin, setLinkedin] = useState(linkedinLink);
  const [project, setProject] = useState(projectLink);
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Sync pre-filled values when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setCoursera(courseraLink);
      setLinkedin(linkedinLink);
      setProject(projectLink);
      setDescription("");
      setImageFile(null);
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!description.trim()) {
      toast.error("Please describe the issue.");
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl: string | null = null;

      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("report-images")
          .upload(path, imageFile);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("report-images")
          .getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from("reports" as any).insert({
        user_id: user.id,
        coursera_link: coursera.trim(),
        linkedin_link: linkedin.trim(),
        project_link: project.trim() || null,
        description: description.trim(),
        image_url: imageUrl,
      } as any);

      if (error) throw error;

      toast.success("Report submitted. We'll review it shortly.");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report an Issue</DialogTitle>
          <DialogDescription>
            Let us know if you believe the verification result is incorrect.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-coursera">Coursera Certificate Link</Label>
            <Input
              id="report-coursera"
              value={coursera}
              onChange={(e) => setCoursera(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-project">Coursera Project Link</Label>
            <Input
              id="report-project"
              value={project}
              onChange={(e) => setProject(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-linkedin">LinkedIn Post Link</Label>
            <Input
              id="report-linkedin"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Screenshot (optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              {imageFile ? (
                <>
                  <ImageIcon className="h-4 w-4" />
                  {imageFile.name}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload screenshot
                </>
              )}
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-desc">Describe the issue</Label>
            <Textarea
              id="report-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain what went wrong with the verification..."
              rows={3}
            />
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting || !description.trim()}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
              </>
            ) : (
              "Submit Report"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
