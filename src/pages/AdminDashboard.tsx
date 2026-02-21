import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, FileCheck, BarChart3, ShieldCheck, UserCheck } from "lucide-react";
import AdminStats from "@/components/admin/AdminStats";
import AdminLeaderboard from "@/components/admin/AdminLeaderboard";
import AdminSubmissions from "@/components/admin/AdminSubmissions";
import AdminRequests from "@/components/admin/AdminRequests";

const HEAD_ADMIN_EMAIL = [
  "agoel2_be23@thapar.edu",
  "prashant.singh@thapar.edu"
];

export default function AdminDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const isHeadAdmin = HEAD_ADMIN_EMAIL.includes(profile?.email ?? "");
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }
    supabase
      .from("user_roles" as any)
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .then(({ data }: any) => {
        setIsAdmin(data && data.length > 0);
      });
  }, [user, authLoading, navigate]);

  if (authLoading || isAdmin === null) {
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
        <TabsList className={`grid w-full ${isHeadAdmin ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Stats
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="gap-2">
            <Users className="h-4 w-4" /> Leaderboard
          </TabsTrigger>
          <TabsTrigger value="submissions" className="gap-2">
            <FileCheck className="h-4 w-4" /> Submissions
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
        <TabsContent value="leaderboard">
          <AdminLeaderboard />
        </TabsContent>
        <TabsContent value="submissions">
          <AdminSubmissions />
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

// import { useState, useEffect } from "react";
// import { useNavigate } from "react-router-dom";
// import { useAuth } from "@/lib/auth";
// import { supabase } from "@/integrations/supabase/client";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { Loader2, Users, FileCheck, BarChart3, ShieldCheck, UserCheck } from "lucide-react";
// import AdminStats from "@/components/admin/AdminStats";
// import AdminLeaderboard from "@/components/admin/AdminLeaderboard";
// import AdminSubmissions from "@/components/admin/AdminSubmissions";
// import AdminRequests from "@/components/admin/AdminRequests";

// export default function AdminDashboard() {
//   const { user, loading: authLoading } = useAuth();
//   const navigate = useNavigate();
//   const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

//   useEffect(() => {
//     if (authLoading) return;
//     if (!user) {
//       navigate("/auth", { replace: true });
//       return;
//     }
//     supabase
//       .from("user_roles" as any)
//       .select("role")
//       .eq("user_id", user.id)
//       .eq("role", "admin")
//       .then(({ data }: any) => {
//         setIsAdmin(data && data.length > 0);
//       });
//   }, [user, authLoading, navigate]);

//   if (authLoading || isAdmin === null) {
//     return (
//       <div className="flex items-center justify-center py-20">
//         <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
//       </div>
//     );
//   }

//   if (!isAdmin) {
//     return (
//       <div className="container py-20 text-center">
//         <ShieldCheck className="h-16 w-16 mx-auto text-destructive mb-4" />
//         <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
//         <p className="text-muted-foreground">You do not have admin privileges to access this page.</p>
//       </div>
//     );
//   }

//   return (
//     <div className="container py-8">
//       <div className="flex items-center gap-3 mb-6">
//         <ShieldCheck className="h-6 w-6 text-primary" />
//         <h1 className="text-2xl font-bold">Admin Dashboard</h1>
//       </div>

//       <Tabs defaultValue="stats" className="space-y-6">
//         <TabsList className="grid w-full grid-cols-4">
//           <TabsTrigger value="stats" className="gap-2">
//             <BarChart3 className="h-4 w-4" /> Stats
//           </TabsTrigger>
//           <TabsTrigger value="leaderboard" className="gap-2">
//             <Users className="h-4 w-4" /> Leaderboard
//           </TabsTrigger>
//           <TabsTrigger value="submissions" className="gap-2">
//             <FileCheck className="h-4 w-4" /> Submissions
//           </TabsTrigger>
//           <TabsTrigger value="requests" className="gap-2">
//             <UserCheck className="h-4 w-4" /> Requests
//           </TabsTrigger>
//         </TabsList>

//         <TabsContent value="stats">
//           <AdminStats />
//         </TabsContent>
//         <TabsContent value="leaderboard">
//           <AdminLeaderboard />
//         </TabsContent>
//         <TabsContent value="submissions">
//           <AdminSubmissions />
//         </TabsContent>
//         <TabsContent value="requests">
//           <AdminRequests />
//         </TabsContent>
//       </Tabs>
//     </div>
//   );
// }
