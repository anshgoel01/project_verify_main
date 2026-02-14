import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, CheckCircle, Zap, Shield } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero */}
      <section className="container py-20 md:py-32 text-center">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm font-medium">
            <Zap className="h-4 w-4 text-primary" /> Automated Project Verification
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            Verify Your Guided Projects.{" "}
            <span className="text-primary">Climb the Leaderboard.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Submit your Coursera certificates and LinkedIn posts for instant automated verification.
            Compete with peers in your college on the real-time leaderboard.
          </p>
          <div className="flex justify-center gap-4">
            <Button size="lg" asChild>
              <Link to="/auth">Get Started</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/leaderboard">View Leaderboard</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container pb-20">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: CheckCircle, title: "Instant Verification", desc: "Submit links and get automated verification results in seconds." },
            { icon: Trophy, title: "College Leaderboard", desc: "Compete with peers. Earn points for every verified project submission." },
            { icon: Shield, title: "Reliable & Fair", desc: "Fuzzy name matching and course detection ensure accurate, fair results." },
          ].map((f) => (
            <Card key={f.title} className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6 space-y-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">{f.title}</h3>
                <p className="text-muted-foreground text-sm">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
