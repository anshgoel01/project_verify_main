import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserCheck, UserX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { HEAD_ADMIN_EMAILS, isHeadAdmin } from "@/lib/constants";

type AdminRequest = {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  user_email: string;
  user_name: string;
};

export default function AdminRequests() {
  const { profile } = useAuth();
  const headAdmin = isHeadAdmin(profile?.email);
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [existingAdmins, setExistingAdmins] = useState<{ user_id: string; name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    setLoading(true);
    const { data: reqs } = await supabase
      .from("admin_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (reqs) {
      const userIds = reqs.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      setRequests(reqs.map((r) => ({
        ...r,
        user_email: profileMap.get(r.user_id)?.email || "Unknown",
        user_name: profileMap.get(r.user_id)?.full_name || "Unknown",
      })));
    }

    // Fetch existing admins (for head admin to manage)
    if (headAdmin) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (roles && roles.length > 0) {
        const adminUserIds = roles.map((r) => r.user_id);
        const { data: adminProfiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", adminUserIds);

        setExistingAdmins(
          (adminProfiles || [])
            .filter((p) => !HEAD_ADMIN_EMAILS.includes(p.email))
            .map((p) => ({ user_id: p.user_id, name: p.full_name, email: p.email }))
        );
      }
    }

    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleAction = async (requestId: string, userId: string, action: "approved" | "rejected") => {
    const { error } = await supabase
      .from("admin_requests")
      .update({ status: action, reviewed_at: new Date().toISOString() })
      .eq("id", requestId);

    if (error) {
      toast.error("Failed to update request");
      return;
    }

    if (action === "approved") {
      const { error: roleErr } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (roleErr) {
        toast.error("Failed to assign admin role");
        return;
      }
    }

    toast.success(`Request ${action}`);
    fetchRequests();
  };

  const handleRemoveAdmin = async (userId: string) => {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "admin");

    if (error) {
      toast.error("Failed to remove admin role");
      return;
    }

    toast.success("Admin role removed");
    fetchRequests();
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Existing Admins - only visible to head admin */}
      {headAdmin && existingAdmins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Current Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {existingAdmins.map((admin) => (
                    <TableRow key={admin.user_id}>
                      <TableCell className="font-medium">{admin.name}</TableCell>
                      <TableCell>{admin.email}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="destructive" onClick={() => handleRemoveAdmin(admin.user_id)} className="gap-1">
                          <Trash2 className="h-4 w-4" /> Remove Admin
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No admin requests.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.user_name}</TableCell>
                      <TableCell>{r.user_email}</TableCell>
                      <TableCell className="whitespace-nowrap">{format(new Date(r.created_at), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.status === "pending" ? (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleAction(r.id, r.user_id, "approved")} className="gap-1">
                              <UserCheck className="h-4 w-4" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleAction(r.id, r.user_id, "rejected")} className="gap-1">
                              <UserX className="h-4 w-4" /> Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {r.reviewed_at ? format(new Date(r.reviewed_at), "MMM d, yyyy") : "—"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
