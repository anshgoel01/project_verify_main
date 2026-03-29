import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ResetPassword() {
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const [ready, setReady] = useState(false);
    const { updatePassword } = useAuth();
    const navigate = useNavigate();

    // Supabase redirects back with a session after clicking the reset link
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === "PASSWORD_RECOVERY") {
                setReady(true);
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) {
            toast.error("Passwords do not match");
            return;
        }
        if (password.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }
        setLoading(true);
        const { error } = await updatePassword(password);
        if (error) {
            toast.error(error);
        } else {
            toast.success("Password updated successfully!");
            navigate("/");
        }
        setLoading(false);
    };

    if (!ready) {
        return (
            <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <CardTitle>Waiting for verification...</CardTitle>
                        <CardDescription>
                            Please click the reset link in your email to continue.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle>Set New Password</CardTitle>
                    <CardDescription>Enter your new password below</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-password">New Password</Label>
                            <Input
                                id="new-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm Password</Label>
                            <Input
                                id="confirm-password"
                                type="password"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                required
                                minLength={6}
                                placeholder="••••••••"
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Updating..." : "Update Password"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}