import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Menu, X, Trophy, Send, User, LayoutDashboard, ShieldCheck, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { isHeadAdmin } from "@/lib/constants";

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const headAdmin = isHeadAdmin(profile?.email);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase
      .from("user_roles" as any)
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .then(({ data }: any) => {
        setIsAdmin(data && data.length > 0);
      });
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const links = user
    ? [
        ...(isAdmin && !headAdmin ? [] : [
          { to: "/submit", label: "Submit", icon: Send },
          { to: "/my-submissions", label: "My Submissions", icon: LayoutDashboard },
        ]),
        { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
        { to: "/profile", label: "Profile", icon: User },
        ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: ShieldCheck }] : []),
      ]
    : [];

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold text-sm tracking-tight text-foreground">
          <Trophy className="h-4 w-4" />
          <span>VerifyHub</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-0.5">
          {links.map((l) => (
            <Button key={l.to} variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground h-8 px-3 text-[13px]">
              <Link to={l.to} className="gap-1.5">
                <l.icon className="h-3.5 w-3.5" />
                {l.label}
              </Link>
            </Button>
          ))}
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8 text-muted-foreground hover:text-foreground">
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </Button>
          {user ? (
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground h-8 px-3 text-[13px] gap-1.5">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </Button>
          ) : (
            <Button size="sm" asChild className="h-8 px-4 text-[13px] rounded-md">
              <Link to="/auth">Sign In</Link>
            </Button>
          )}
        </div>

        {/* Mobile toggle */}
        <div className="flex items-center gap-1 md:hidden">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8 text-muted-foreground">
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t pb-3">
          <div className="container flex flex-col gap-0.5 pt-2">
            {links.map((l) => (
              <Button key={l.to} variant="ghost" size="sm" asChild className="justify-start text-muted-foreground hover:text-foreground h-8 text-[13px]" onClick={() => setMobileOpen(false)}>
                <Link to={l.to} className="gap-2">
                  <l.icon className="h-3.5 w-3.5" />
                  {l.label}
                </Link>
              </Button>
            ))}
            {user ? (
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="justify-start text-muted-foreground hover:text-foreground h-8 text-[13px] gap-2">
                <LogOut className="h-3.5 w-3.5" /> Logout
              </Button>
            ) : (
              <Button size="sm" asChild className="h-8 text-[13px]">
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
// import { isHeadAdmin } from "@/lib/constants";

// export default function Navbar() {
//   const { user, profile, signOut } = useAuth();
//   const navigate = useNavigate();
//   const [mobileOpen, setMobileOpen] = useState(false);
//   const [isAdmin, setIsAdmin] = useState(false);

//   const headAdmin = isHeadAdmin(profile?.email);

//   useEffect(() => {
//     if (!user) { setIsAdmin(false); return; }
//     supabase
//       .from("user_roles")
//       .select("role")
//       .eq("user_id", user.id)
//       .eq("role", "admin")
//       .then(({ data }) => {
//         setIsAdmin(data && data.length > 0);
//       });
//   }, [user]);

//   const handleSignOut = async () => {
//     await signOut();
//     navigate("/");
//   };

//   const links = user
//     ? [
//         // Regular admins (not head admin) only see Leaderboard, Profile, Admin
//         ...(isAdmin && !headAdmin ? [] : [
//           { to: "/submit", label: "Submit", icon: Send },
//           { to: "/my-submissions", label: "My Submissions", icon: LayoutDashboard },
//         ]),
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
