import { Link } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Trophy, Zap, Shield, Bot, BarChart3,
  Lock, Upload, Cpu, ArrowRight, Users, FileCheck, Medal, Clock
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import SectionBadge from "@/components/landing/SectionBadge";
import { useAuth } from "@/lib/auth";

/* ── animation helpers ── */
const easeOut = [0.22, 1, 0.36, 1] as [number, number, number, number];

const heroVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: easeOut },
  }),
};

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: easeOut },
  }),
};

/* ── count-up hook ── */
function useCountUp(target: number, duration = 1500) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (target > 0) started.current = false;

    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current && target > 0) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            setVal(Math.floor(progress * target));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return { val, ref };
}

/* ── data ── */
const features = [
  { icon: Bot, title: "AI Name Matching", desc: "Fuzzy matching ensures your certificate name matches your profile accurately.", iconBg: "bg-blue-500/10", iconColor: "text-blue-500", featured: true },
  { icon: Zap, title: "Instant Verification", desc: "Get results in seconds, not hours.", iconBg: "bg-amber-500/10", iconColor: "text-amber-500" },
  { icon: Trophy, title: "Real-time Leaderboard", desc: "Scores update live as submissions are verified.", iconBg: "bg-yellow-500/10", iconColor: "text-yellow-500" },
  { icon: Shield, title: "Admin Dashboard", desc: "Faculty can monitor all submissions and manage projects.", iconBg: "bg-purple-500/10", iconColor: "text-purple-500" },
  { icon: BarChart3, title: "Relative Percentile Grading", desc: "Final marks (out of 8) are awarded relatively based on your rank compared to your peers.", iconBg: "bg-green-500/10", iconColor: "text-green-500" },
  { icon: Lock, title: "Secure & Fair", desc: "Every submission is verified independently with no manual bias.", iconBg: "bg-red-500/10", iconColor: "text-red-500" },
];

const steps = [
  { num: 1, icon: Upload, title: "Submit Your Links", desc: "Paste your Coursera certificate, project link, and LinkedIn post." },
  { num: 2, icon: Cpu, title: "AI Verifies Instantly", desc: "Our system checks your name, course, and LinkedIn post automatically." },
  { num: 3, icon: Trophy, title: "Climb the Leaderboard", desc: "Earn points and compete with peers across your college." },
];

const techStack = ["React", "TypeScript", "Vercel", "Tailwind CSS", "shadcn/ui", "PostgreSQL", "Vite"];

const faqs = [
  {
    question: "How does the AI verification work?",
    answer: "Our system uses advanced AI to scan your Coursera certificate, verify your project link, and check your LinkedIn post. It ensures your name matches, the course level is accurate, and the submission is completely legitimate."
  },
  {
    question: "How are the marks calculated?",
    answer: "We use a true relative grading system (percentile banding). You earn a raw score based on project difficulty. At the end, students are ranked by raw score into percentiles, and final marks (out of 8) are awarded based on how you compare to your peers."
  },
  {
    question: "Why isn’t my Coursera link working?",
    answer: "Make sure the link you’re submitting is specifically from a Coursera Guided Project. This platform only accepts Guided Project links, so regular course links, specializations, or certificates won’t work here"
  },
  {
    question: "How are ranks decided?",
    answer: "Ranks are determined purely by the quality and level of the projects you upload. More advanced, impactful projects lead to higher rankings."
  }
];

type TopEntry = { full_name: string; score: number };

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
  return (
    <span className="h-7 w-7 rounded-full bg-secondary text-xs font-bold flex items-center justify-center text-foreground">
      {rank}
    </span>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const [studentCount, setStudentCount] = useState(0);
  const [projectCount, setProjectCount] = useState(0);
  const [topEntries, setTopEntries] = useState<TopEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("submissions").select("id", { count: "exact", head: true }).eq("status", "correct"),
      supabase.from("profiles").select("full_name, score").gt("score", 0).order("score", { ascending: false }).limit(5)
    ]).then(([students, projects, top]) => {
      if (students.count) setStudentCount(students.count);
      if (projects.count) setProjectCount(projects.count);
      if (top.data) setTopEntries(top.data);
      setIsLoadingLeaderboard(false);
    });
  }, []);

  const students = useCountUp(studentCount, 1200);
  const projects = useCountUp(projectCount, 1200);

  const privacyName = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length < 2) return name;
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 -z-10 animate-gradient-shift bg-[length:400%_400%] bg-gradient-to-br from-background via-primary/5 to-background" />

      {/* ─── HERO ─── */}
      <section className="container py-16 md:py-24 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] bg-primary/8 blur-[100px] rounded-full animate-pulse-slow pointer-events-none" aria-hidden="true" />

        <div className="grid md:grid-cols-2 gap-10 items-center relative">
          {/* Left — Copy */}
          <div className="space-y-6 text-center md:text-left">
            <motion.div custom={0} initial="hidden" animate="visible" variants={heroVariants}
              className="inline-flex items-center gap-2 rounded-full border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
              <Zap className="h-3 w-3" /> Automated Project Verification
            </motion.div>

            <motion.h1 custom={1} initial="hidden" animate="visible" variants={heroVariants}
              className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl leading-tight">
              <span className="text-foreground">Automated AI Verification for Guided Projects.</span>{" "}
              <span className="text-muted-foreground">Built for Thapar Students.</span>
            </motion.h1>

            <motion.p custom={2} initial="hidden" animate="visible" variants={heroVariants}
              className="text-sm text-muted-foreground max-w-lg leading-relaxed mx-auto md:mx-0">
              VerifyHub uses AI to instantly verify Coursera certificates and LinkedIn posts — no manual checking, no delays. Submit, verify, and compete on the real-time leaderboard.
            </motion.p>

            <motion.div custom={3} initial="hidden" animate="visible" variants={heroVariants}
              className="flex gap-3 justify-center md:justify-start">
              <Button size="lg" asChild className="h-10 px-6 text-sm rounded-md shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-105 transition-all duration-200">
                <Link to={user ? "/submit" : "/auth"}>Get Started</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="h-10 px-6 text-sm rounded-md">
                <Link to="/leaderboard">View Leaderboard</Link>
              </Button>
            </motion.div>
          </div>

          {/* Right — Dashboard Preview */}
          <motion.div custom={2} initial="hidden" animate="visible" variants={heroVariants}
            className="hidden md:block">
            <div className="rounded-lg border bg-card overflow-hidden shadow-2xl shadow-primary/10 ring-2 ring-primary/20">
              <div className="flex items-center gap-1.5 px-3 py-2 bg-secondary/60 border-b">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                <span className="ml-3 text-xs text-muted-foreground truncate">projectverifier.vercel.app/admin</span>
              </div>
              <div className="w-full aspect-video overflow-hidden bg-muted">
                <img
                  src="/adminstats.png"
                  alt="Dashboard Preview"
                  width={1280}
                  height={720}
                  fetchPriority="high"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── LIVE STATS ─── */}
      <section className="border-y bg-gradient-to-r from-primary/5 via-background to-primary/5 py-2 md:py-6">
        <SectionBadge label="By The Numbers" />
        <div className="container grid grid-cols-1 sm:grid-cols-3 gap-6 text-center mt-6">
          <div ref={students.ref} className="space-y-2">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0} variants={fadeUp}
              className="flex flex-col items-center gap-2">
              <div className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center">
                <Users className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="h-10 flex items-center justify-center">
                {isLoadingLeaderboard ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <p className="text-4xl font-black text-foreground">{students.val}+</p>
                )}
              </div>
            </motion.div>
            <p className="text-sm text-muted-foreground">Students Registered</p>
          </div>
          <div ref={projects.ref} className="space-y-2">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1} variants={fadeUp}
              className="flex flex-col items-center gap-2">
              <div className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center">
                <FileCheck className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="h-10 flex items-center justify-center">
                {isLoadingLeaderboard ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-4xl font-black text-foreground">{projects.val}+</p>
                )}
              </div>
            </motion.div>
            <p className="text-sm text-muted-foreground">Projects Verified</p>
          </div>
          <div className="space-y-2">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={2} variants={fadeUp}
              className="flex flex-col items-center gap-2">
              <div className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center">
                <Clock className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-4xl font-black text-foreground">&lt; 5s</p>
            </motion.div>
            <p className="text-sm text-muted-foreground">Avg Verification Time</p>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="container py-10 md:py-14">
        <SectionBadge label="Simple Process" />
        <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0} variants={fadeUp}
          className="text-2xl font-bold text-center text-foreground mb-10 mt-4">
          How It Works
        </motion.h2>

        <div className="relative grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
          <div className="hidden md:block absolute top-8 left-[16.67%] right-[16.67%] h-0.5 overflow-hidden" aria-hidden="true">
            <div className="w-full h-full"
              style={{ backgroundImage: "repeating-linear-gradient(90deg, hsl(var(--primary) / 0.6) 0px, hsl(var(--primary) / 0.6) 4px, transparent 4px, transparent 8px)" }} />
          </div>

          {steps.map((s, i) => (
            <motion.div key={s.num} custom={i} initial="hidden" whileInView="visible"
              viewport={{ once: true, margin: "-40px" }} variants={fadeUp}
              className="relative text-center space-y-3">
              <div className="mx-auto h-16 w-16 rounded-full bg-secondary border flex items-center justify-center relative z-10">
                <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-md">
                  {s.num}
                </span>
                <s.icon className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="font-semibold text-sm text-foreground">{s.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px] mx-auto">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── LEADERBOARD PREVIEW ─── */}
      <section className="container py-10 md:py-14">
        <SectionBadge label="Live Rankings" />
        <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0} variants={fadeUp}
          className="text-2xl font-bold text-center text-foreground mb-8 mt-4">
          Top Students
        </motion.h2>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1} variants={fadeUp}
          className="max-w-md mx-auto">
          <Card className="min-h-[200px]">
            <CardContent className="p-0">
              {isLoadingLeaderboard ? (
                <ul className="divide-y p-2 lg:p-4">
                  {[...Array(5)].map((_, i) => (
                    <li key={i} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3 w-full">
                        <Skeleton className="h-7 w-7 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="h-4 w-10" />
                    </li>
                  ))}
                </ul>
              ) : topEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm h-full flex items-center justify-center">No submissions yet.</p>
              ) : (
                <ul className="divide-y">
                  {topEntries.map((e, i) => (
                    <li key={i} className={`flex items-center justify-between px-4 py-3 transition-colors duration-150 hover:bg-muted/50 ${i === 0 ? "bg-yellow-500/5 border-l-2 border-l-yellow-500/30" : ""}`}>
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 flex items-center justify-center">
                          <RankBadge rank={i + 1} />
                        </div>
                        <span className="text-sm font-medium text-foreground">{privacyName(e.full_name)}</span>
                      </div>
                      <span className="text-sm font-bold text-foreground">{(Number(e.score) * 100).toFixed(1)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <div className="text-center mt-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/leaderboard">View Full Leaderboard <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* ─── FEATURES ─── */}
      <section className="container py-10 md:py-14">
        <SectionBadge label="Everything You Need" />
        <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0} variants={fadeUp}
          className="text-2xl font-bold text-center text-foreground mb-10 mt-4">
          Features
        </motion.h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
          {features.map((f, i) => (
            <motion.div key={f.title} custom={i} initial="hidden" whileInView="visible"
              viewport={{ once: true, margin: "-40px" }} variants={fadeUp}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className={`rounded-md border bg-card p-5 space-y-2.5 transition-shadow duration-200 hover:shadow-lg hover:shadow-primary/5 ${f.featured ? "border-primary/50 sm:col-span-2 lg:col-span-1 ring-1 ring-primary/20" : ""}`}>
              <div className={`h-9 w-9 rounded-md flex items-center justify-center ${f.iconBg ?? "bg-secondary"}`}>
                <f.icon className={`h-4 w-4 ${f.iconColor ?? "text-foreground"}`} />
              </div>
              <h3 className="font-medium text-sm text-foreground">{f.title}</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── TECH STACK ───
      <section className="container py-10 md:py-14 text-center">
        <SectionBadge label="Built With" />
        <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0} variants={fadeUp}
          className="text-lg font-semibold text-muted-foreground mb-4 mt-4">
          Built with modern tech
        </motion.h2>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1} variants={fadeUp}
          className="flex flex-wrap justify-center gap-2">
          {techStack.map((t) => (
            <Badge key={t} variant="secondary" className="text-xs font-normal">{t}</Badge>
          ))}
        </motion.div>
      </section> */}

      {/* ─── FAQ ─── */}
      <section className="container py-10 md:py-14">
        <SectionBadge label="FAQ" />
        <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0} variants={fadeUp}
          className="text-2xl font-bold text-center text-foreground mb-10 mt-4">
          Frequently Asked Questions
        </motion.h2>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1} variants={fadeUp}
          className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border rounded-lg px-4 bg-card shadow-sm shadow-primary/5">
                <AccordionTrigger className="text-left font-semibold hover:no-underline hover:text-primary transition-colors">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="bg-secondary/40 py-10 md:py-14">
        <div className="container text-center space-y-4">
          <SectionBadge label="Get Started Today" />
          <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0} variants={fadeUp}
            className="text-2xl sm:text-3xl font-bold text-foreground">
            Ready to get verified?
          </motion.h2>
          <motion.p initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1} variants={fadeUp}
            className="text-sm text-muted-foreground max-w-md mx-auto">
            Join your peers on VerifyHub and start building your verified project portfolio.
          </motion.p>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={2} variants={fadeUp}
            className="flex justify-center gap-3 pt-2">
            <Button size="lg" asChild className="h-10 px-6 text-sm rounded-md shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-105 transition-all duration-200">
              <Link to={user ? "/submit" : "/auth"}>Get Started</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="h-10 px-6 text-sm rounded-md">
              <Link to="/leaderboard">View Leaderboard</Link>
            </Button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}



