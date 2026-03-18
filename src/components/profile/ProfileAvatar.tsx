import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

export default function ProfileAvatar({ fullName }: { fullName: string }) {
    return (
        <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                {getInitials(fullName)}
            </AvatarFallback>
        </Avatar>
    );
}