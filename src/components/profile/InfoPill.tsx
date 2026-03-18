import { LucideIcon } from "lucide-react";

export default function InfoPill({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
    return (
        <div className="inline-flex items-center gap-2 rounded-full bg-muted/60 px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted">
            <Icon className="h-3.5 w-3.5 text-primary" />
            <span>{label}</span>
        </div>
    );
}