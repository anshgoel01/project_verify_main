import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  processing: { label: "Processing", className: "bg-yellow-500/15 text-yellow-700 border-yellow-300" },
  correct: { label: "Correct", className: "bg-green-500/15 text-green-700 border-green-300" },
  wrong: { label: "Wrong", className: "bg-red-500/15 text-red-700 border-red-300" },
  skipped: { label: "Timeout", className: "bg-orange-500/15 text-orange-700 border-orange-300" },
  failed: { label: "Failed", className: "bg-red-500/15 text-red-700 border-red-300" },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.failed;
  return (
    <Badge variant="outline" className={cn("font-medium", config.className)}>
      {config.label}
    </Badge>
  );
}
