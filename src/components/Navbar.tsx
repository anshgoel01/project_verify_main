import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Menu, X, Trophy, Send, User, LayoutDashboard, ShieldCheck } from "lucide-react";
import { useState, useEffect } from "react";

const HEAD_ADMIN_EMAIL = "agoel2_be23@thapar.edu";

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const isHeadAdmin = profile?.email === HEAD_ADMIN_EMAIL;

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }

    // We can't rely on just user.id for the dependency if we want to be strict, 
    // but practically it is fine. The lint warning probably was about something else or just general.
    // The previous code had: .from("user_roles" as any)

    const checkAdmin = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle(); // Use maybeSingle instead of checking array length if we just want to know if it exists

      setIsAdmin(!!data);
    };

    checkAdmin();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const links = user
    ? [
      // Regular admins (not head admin) only see Leaderboard, Profile, Admin
      ...(isAdmin && !isHeadAdmin ? [] : [
        { to: "/submit", label: "Submit", icon: Send },
        { to: "/my-submissions", label: "My Submissions", icon: LayoutDashboard },
      ]),
      { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
      { to: "/profile", label: "Profile", icon: User },
      ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: ShieldCheck }] : []),
    ]
    : [];

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <Trophy className="h-5 w-5 text-primary" />
          <span>VerifyHub</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Button key={l.to} variant="ghost" size="sm" asChild>
              <Link to={l.to} className="gap-1.5">
                <l.icon className="h-4 w-4" />
                {l.label}
              </Link>
            </Button>
          ))}
          {user ? (
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1.5">
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
          )}
        </div>

        {/* Mobile toggle */}
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X /> : <Menu />}
        </Button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t pb-4">
          <div className="container flex flex-col gap-1 pt-2">
            {links.map((l) => (
              <Button key={l.to} variant="ghost" size="sm" asChild className="justify-start" onClick={() => setMobileOpen(false)}>
                <Link to={l.to} className="gap-2">
                  <l.icon className="h-4 w-4" />
                  {l.label}
                </Link>
              </Button>
            ))}
            {user ? (
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="justify-start gap-2">
                <LogOut className="h-4 w-4" /> Logout
              </Button>
            ) : (
              <Button size="sm" asChild>
                <Link to="/auth" onClick={() => setMobileOpen(false)}>Sign In</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

// import { Link, useNavigate } from "react-router-dom";
// import { Button } from "@/components/ui/button";
// import { useAuth } from "@/lib/auth";
// import { supabase } from "@/integrations/supabase/client";
// import { LogOut, Menu, X, Trophy, Send, User, LayoutDashboard, ShieldCheck } from "lucide-react";
// import { useState, useEffect } from "react";

// export default function Navbar() {
//   const { user, profile, signOut } = useAuth();
//   const navigate = useNavigate();
//   const [mobileOpen, setMobileOpen] = useState(false);
//   const [isAdmin, setIsAdmin] = useState(false);

//   useEffect(() => {
//     if (!user) { setIsAdmin(false); return; }
//     supabase
//       .from("user_roles" as any)
//       .select("role")
//       .eq("user_id", user.id)
//       .eq("role", "admin")
//       .then(({ data }: any) => {
//         setIsAdmin(data && data.length > 0);
//       });
//   }, [user]);

//   const handleSignOut = async () => {
//     await signOut();
//     navigate("/");
//   };

//   const links = user
//     ? [
//         { to: "/submit", label: "Submit", icon: Send },
//         { to: "/my-submissions", label: "My Submissions", icon: LayoutDashboard },
//         { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
//         { to: "/profile", label: "Profile", icon: User },
//         ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: ShieldCheck }] : []),
//       ]
//     : [];

//   return (
//     <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
//       <div className="container flex h-16 items-center justify-between">
//         <Link to="/" className="flex items-center gap-2 font-bold text-lg">
//           <Trophy className="h-5 w-5 text-primary" />
//           <span>VerifyHub</span>
//         </Link>

//         {/* Desktop */}
//         <div className="hidden md:flex items-center gap-1">
//           {links.map((l) => (
//             <Button key={l.to} variant="ghost" size="sm" asChild>
//               <Link to={l.to} className="gap-1.5">
//                 <l.icon className="h-4 w-4" />
//                 {l.label}
//               </Link>
//             </Button>
//           ))}
//           {user ? (
//             <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1.5">
//               <LogOut className="h-4 w-4" /> Logout
//             </Button>
//           ) : (
//             <Button size="sm" asChild>
//               <Link to="/auth">Sign In</Link>
//             </Button>
//           )}
//         </div>

//         {/* Mobile toggle */}
//         <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
//           {mobileOpen ? <X /> : <Menu />}
//         </Button>
//       </div>

//       {mobileOpen && (
//         <div className="md:hidden border-t pb-4">
//           <div className="container flex flex-col gap-1 pt-2">
//             {links.map((l) => (
//               <Button key={l.to} variant="ghost" size="sm" asChild className="justify-start" onClick={() => setMobileOpen(false)}>
//                 <Link to={l.to} className="gap-2">
//                   <l.icon className="h-4 w-4" />
//                   {l.label}
//                 </Link>
//               </Button>
//             ))}
//             {user ? (
//               <Button variant="ghost" size="sm" onClick={handleSignOut} className="justify-start gap-2">
//                 <LogOut className="h-4 w-4" /> Logout
//               </Button>
//             ) : (
//               <Button size="sm" asChild>
//                 <Link to="/auth" onClick={() => setMobileOpen(false)}>Sign In</Link>
//               </Button>
//             )}
//           </div>
//         </div>
//       )}
//     </nav>
//   );
// }
