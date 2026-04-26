import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileCheck, BarChart3, ShieldCheck, UserCheck, FolderOpen } from "lucide-react";
import AdminStats from "@/components/admin/AdminStats";
import AdminProjects from "@/components/admin/AdminProjects";
import AdminRequests from "@/components/admin/AdminRequests";

const HEAD_ADMIN_EMAIL = "agoel2_be23@thapar.edu";

export default function AdminDashboard() {
  const { user, profile, isAdmin, isHeadAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container py-20 text-center">
        <ShieldCheck className="h-16 w-16 mx-auto text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You do not have admin privileges to access this page.</p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </div>

      <Tabs defaultValue="stats" className="space-y-6">
        <TabsList className={`grid w-full ${isHeadAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Stats
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-2">
            <FolderOpen className="h-4 w-4" /> Projects
          </TabsTrigger>
          {isHeadAdmin && (
            <TabsTrigger value="requests" className="gap-2">
              <UserCheck className="h-4 w-4" /> Requests
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="stats">
          <AdminStats />
        </TabsContent>
        <TabsContent value="projects">
          <AdminProjects />
        </TabsContent>
        {isHeadAdmin && (
          <TabsContent value="requests">
            <AdminRequests />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
