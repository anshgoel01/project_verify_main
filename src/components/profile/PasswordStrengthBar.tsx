import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

function getPasswordStrength(password: string): { score: number; label: string } {
    if (!password) return { score: 0, label: "" };
    let score = 0;
    if (password.length >= 6) score += 20;
    if (password.length >= 10) score += 20;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 20;
    if (/\d/.test(password)) score += 20;
    if (/[^a-zA-Z0-9]/.test(password)) score += 20;

    if (score <= 20) return { score, label: "Weak" };
    if (score <= 40) return { score, label: "Fair" };
    if (score <= 60) return { score, label: "Moderate" };
    if (score <= 80) return { score, label: "Strong" };
    return { score, label: "Very Strong" };
}

export default function PasswordStrengthBar({ password }: { password: string }) {
    const { score, label } = useMemo(() => getPasswordStrength(password), [password]);

    if (!password) return null;

    const colorClass =
        score <= 20
            ? "[&>div]:bg-muted-foreground"
            : score <= 40
                ? "[&>div]:bg-destructive"
                : score <= 60
                    ? "[&>div]:bg-[hsl(45,90%,45%)]"
                    : "[&>div]:bg-[hsl(142,70%,40%)]";

    return (
        <div className="space-y-1.5">
            <Progress value={score} className={cn("h-1.5 bg-muted", colorClass)} />
            <p className="text-xs text-muted-foreground">{label}</p>
        </div>
    );
}