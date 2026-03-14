"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  GitFork,
  Sparkles,
  Zap,
  FileText,
  ImagePlus,
  Layers,
  Share2,
  BarChart3,
  Eye,
  Timer,
  Type,
  Music,
  Palette,
  MonitorPlay,
} from "lucide-react";

/* ================================================================
   SCROLL ANIMATION HOOK
   ================================================================ */

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

/* ================================================================
   ANIMATED COUNTER
   ================================================================ */

function AnimatedCounter({
  end,
  suffix = "",
  prefix = "",
  duration = 2000,
}: {
  end: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}) {
  const [count, setCount] = useState(0);
  const { ref, isVisible } = useScrollReveal();

  useEffect(() => {
    if (!isVisible) return;
    let startTime: number;
    let raf: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.floor(eased * end));
      if (progress < 1) raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [isVisible, end, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {count}
      {suffix}
    </span>
  );
}

/* ================================================================
   REVEAL WRAPPER
   ================================================================ */

function Reveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "left" | "right" | "scale";
}) {
  const { ref, isVisible } = useScrollReveal();

  const transforms: Record<string, string> = {
    up: "translateY(40px)",
    left: "translateX(-40px)",
    right: "translateX(40px)",
    scale: "scale(0.95)",
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "none" : transforms[direction],
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ================================================================
   MAIN LANDING PAGE COMPONENT
   ================================================================ */

export default function AnimatedLanding() {
  const heroRef = useRef<HTMLDivElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (heroContentRef.current) {
          const parallax = Math.min(y * 0.3, 200);
          const opacity = Math.max(1 - y / 600, 0);
          heroContentRef.current.style.transform = `translateY(${parallax}px)`;
          heroContentRef.current.style.opacity = String(opacity);
        }
        if (navRef.current) {
          if (y > 50) {
            navRef.current.style.backgroundColor = "rgba(5,5,7,0.85)";
            navRef.current.style.backdropFilter = "blur(20px)";
            navRef.current.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
          } else {
            navRef.current.style.backgroundColor = "transparent";
            navRef.current.style.backdropFilter = "none";
            navRef.current.style.borderBottom = "none";
          }
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#050507] text-white overflow-x-hidden">
      {/* ========== NAVBAR ========== */}
      <nav
        ref={navRef}
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-[#7C3AED] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#7C3AED] to-[#A855F7]" />
                <GitFork className="relative h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                Clip<span className="text-[#A3E635]">Fork</span>
              </span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              {["Features", "How it Works", "Pricing", "FAQ"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                  className="text-sm text-white/40 hover:text-white transition-colors duration-200"
                >
                  {item}
                </a>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/sign-in"
                className="hidden sm:inline-flex text-sm text-white/50 hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="group relative inline-flex items-center gap-1.5 rounded-lg bg-[#7C3AED] px-4 py-2 text-sm font-medium text-white overflow-hidden transition-all hover:shadow-lg hover:shadow-[#7C3AED]/25"
              >
                <span className="relative z-10">Start free</span>
                <div className="absolute inset-0 bg-gradient-to-r from-[#7C3AED] to-[#A855F7] opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ========== HERO ========== */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center pt-16">
        {/* Animated background */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: "64px 64px",
            }}
          />
          {/* Gradient orbs — static, GPU-promoted */}
          <div
            className="absolute w-[600px] h-[600px] rounded-full blur-[80px] will-change-transform"
            style={{
              background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)",
              top: "10%",
              left: "20%",
            }}
          />
          <div
            className="absolute w-[500px] h-[500px] rounded-full blur-[70px] will-change-transform"
            style={{
              background: "radial-gradient(circle, rgba(163,230,53,0.06) 0%, transparent 70%)",
              top: "30%",
              right: "10%",
            }}
          />
          <div
            className="absolute w-[400px] h-[400px] rounded-full blur-[60px] will-change-transform"
            style={{
              background: "radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)",
              bottom: "10%",
              left: "40%",
            }}
          />
        </div>

        <div
          ref={heroContentRef}
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full will-change-[transform,opacity]"
        >
          <div className="mx-auto max-w-4xl text-center">
            {/* Badge */}
            <div
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#7C3AED]/20 bg-[#7C3AED]/5 px-4 py-1.5 text-sm text-[#A3E635] animate-fade-in"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Reverse-engineer virality. One paste away.
            </div>

            {/* Headline */}
            <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl leading-[0.95] animate-fade-in-up">
              Fork any viral.
              <br />
              <span className="relative">
                <span className="bg-gradient-to-r from-[#7C3AED] via-[#A855F7] to-[#A3E635] bg-clip-text text-transparent animate-gradient-x bg-[length:200%_auto]">
                  Ship your version.
                </span>
              </span>
            </h1>

            {/* Subheadline */}
            <p className="mx-auto mt-6 max-w-xl text-base sm:text-lg text-white/40 leading-relaxed animate-fade-in-up-delay">
              Paste a TikTok or Instagram URL. AI deconstructs the viral
              structure and rebuilds it with your product, your brand, your voice.
            </p>

            {/* CTA */}
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center animate-fade-in-up-delay-2">
              <Link
                href="/sign-up"
                className="group relative inline-flex items-center gap-2 rounded-xl bg-[#7C3AED] px-8 py-4 text-base font-semibold text-white shadow-2xl shadow-[#7C3AED]/20 overflow-hidden transition-all hover:shadow-[#7C3AED]/40 hover:-translate-y-0.5"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Start forking free
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-[#7C3AED] to-[#A855F7] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
              <span className="text-sm text-white/25">
                No credit card required
              </span>
            </div>
          </div>

          {/* ========== SCROLL-STOPPING PRODUCT DEMO ========== */}
          <Reveal className="mx-auto mt-20 max-w-5xl" delay={200} direction="scale">
            <div
              className="relative rounded-2xl border border-white/[0.08] bg-[#0C0C14] shadow-2xl shadow-[#7C3AED]/5 overflow-hidden"
              style={{
                perspective: "1200px",
              }}
            >
              {/* Glow border effect */}
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-[#7C3AED]/20 via-transparent to-[#A3E635]/10 -z-10 blur-sm" />

              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/5 bg-[#0A0A12]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                  <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                  <div className="w-3 h-3 rounded-full bg-[#28CA41]" />
                </div>
                <div className="flex-1 mx-8">
                  <div className="mx-auto max-w-sm rounded-lg bg-white/[0.04] border border-white/5 px-4 py-1.5 text-xs text-white/25 text-center flex items-center justify-center gap-2">
                    <svg className="w-3 h-3 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    clipfork.app/clone
                  </div>
                </div>
              </div>

              {/* App content */}
              <div className="p-6 sm:p-8 lg:p-10">
                {/* Step indicator */}
                <div className="flex items-center gap-3 mb-8">
                  {["Paste URL", "Review Structure", "Customize"].map((label, i) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        i === 1 ? "bg-[#7C3AED] text-white" : i === 0 ? "bg-[#7C3AED]/20 text-[#7C3AED]" : "bg-white/5 text-white/20"
                      }`}>
                        {i === 0 ? <Check className="w-3.5 h-3.5" /> : i + 1}
                      </div>
                      <span className={`hidden sm:block text-xs ${i === 1 ? "text-white/60" : "text-white/20"}`}>{label}</span>
                      {i < 2 && <div className={`w-8 lg:w-16 h-px ${i === 0 ? "bg-[#7C3AED]/40" : "bg-white/5"}`} />}
                    </div>
                  ))}
                </div>

                <div className="grid gap-6 lg:grid-cols-5">
                  {/* Video preview */}
                  <div className="lg:col-span-2">
                    <div className="aspect-[9/16] max-h-[380px] rounded-xl bg-gradient-to-br from-[#1E1B4B]/80 to-[#7C3AED]/20 border border-white/[0.06] flex flex-col items-center justify-center gap-3 relative overflow-hidden group">
                      {/* Animated scan line */}
                      <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#7C3AED]/40 to-transparent animate-scan" />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <MonitorPlay className="h-10 w-10 text-white/20 relative z-10" />
                      <span className="text-xs text-white/25 relative z-10">
                        Analyzing structure...
                      </span>
                      {/* Engagement overlay */}
                      <div className="absolute bottom-4 left-4 right-4 z-10">
                        <div className="flex items-center gap-2 text-[10px] text-white/40">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" /> 2.4M views
                          </span>
                          <span className="text-white/10">|</span>
                          <span>Skincare</span>
                          <span className="text-white/10">|</span>
                          <span>0:28</span>
                        </div>
                        {/* Animated progress bar */}
                        <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full bg-[#7C3AED] animate-progress" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Analysis results */}
                  <div className="lg:col-span-3 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold uppercase tracking-widest text-[#7C3AED]">
                        Structure Analysis
                      </span>
                      <span className="text-[10px] text-white/20 flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#A3E635] animate-pulse" />
                        Live
                      </span>
                    </div>

                    {[
                      { time: "0:00–0:03", type: "Hook", desc: "Pattern interrupt — question overlay + zoom", color: "#F43F5E", delay: 0 },
                      { time: "0:03–0:08", type: "Problem", desc: "Pain point with b-roll + text overlay", color: "#F59E0B", delay: 80 },
                      { time: "0:08–0:16", type: "Solution", desc: "Product reveal with unboxing sequence", color: "#7C3AED", delay: 160 },
                      { time: "0:16–0:22", type: "Proof", desc: "Before/after with trending audio drop", color: "#06B6D4", delay: 240 },
                      { time: "0:22–0:28", type: "CTA", desc: "Urgency close + link-in-bio callout", color: "#A3E635", delay: 320 },
                    ].map((scene) => (
                      <Reveal key={scene.type} delay={scene.delay} direction="right">
                        <div className="group/scene flex items-start gap-3 rounded-lg border border-white/[0.04] bg-white/[0.015] p-3 transition-all hover:border-white/[0.08] hover:bg-white/[0.03]">
                          <div
                            className="mt-0.5 w-2 h-2 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-[#0C0C14]"
                            style={{ backgroundColor: scene.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-white/20 font-mono tabular-nums">
                                {scene.time}
                              </span>
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                style={{
                                  backgroundColor: `${scene.color}12`,
                                  color: scene.color,
                                }}
                              >
                                {scene.type}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-white/35 truncate">
                              {scene.desc}
                            </p>
                          </div>
                        </div>
                      </Reveal>
                    ))}

                    {/* Detected elements */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {[
                        { icon: Music, label: "Trending audio" },
                        { icon: Type, label: "Word-by-word captions" },
                        { icon: Timer, label: "Fast cuts (2.3s avg)" },
                        { icon: Palette, label: "Dynamic Minimalism" },
                      ].map(({ icon: Icon, label }) => (
                        <div
                          key={label}
                          className="flex items-center gap-1.5 rounded-md border border-white/[0.04] bg-white/[0.02] px-2.5 py-1.5 text-[10px] text-white/30"
                        >
                          <Icon className="h-3 w-3" />
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Scroll indicator */}
          <div className="flex justify-center mt-12 animate-bounce-slow">
            <ChevronDown className="w-5 h-5 text-white/15" />
          </div>
        </div>
      </section>

      {/* ========== STATS BAR ========== */}
      <section className="py-16 border-y border-white/[0.04]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: 5, suffix: " scenes", label: "Avg. structure depth" },
              { value: 28, suffix: "s", label: "Avg. video analyzed" },
              { value: 6, suffix: " formats", label: "Supported platforms" },
              { value: 10, suffix: " min", prefix: "<", label: "To first video" },
            ].map((stat) => (
              <Reveal key={stat.label} direction="up">
                <div>
                  <div className="text-3xl sm:text-4xl font-extrabold text-white">
                    <AnimatedCounter
                      end={stat.value}
                      suffix={stat.suffix}
                      prefix={stat.prefix || ""}
                    />
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-white/30">{stat.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========== FEATURES — BENTO GRID ========== */}
      <section id="features" className="scroll-mt-20 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center mb-16">
              <span className="text-sm font-semibold uppercase tracking-widest text-[#7C3AED]">
                Features
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                Turn proven virality into
                <br />
                <span className="text-white/40">your next winning ad.</span>
              </h2>
            </div>
          </Reveal>

          {/* Bento grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: GitFork,
                title: "Viral Structure Cloning",
                desc: "Paste any TikTok or IG URL. AI deconstructs hook timing, transitions, overlays, pacing, and music cues into a frame-by-frame blueprint.",
                color: "#7C3AED",
                span: "lg:col-span-2",
              },
              {
                icon: FileText,
                title: "AI Script Generation",
                desc: "Scripts reverse-engineered from formats that already went viral — the hook formula, tension arc, CTA placement — customized for your product.",
                color: "#A3E635",
              },
              {
                icon: ImagePlus,
                title: "Smart Asset Replacement",
                desc: "Upload product shots and brand assets. ClipFork maps them into the cloned structure — matching duration, pacing, and overlay timing.",
                color: "#06B6D4",
              },
              {
                icon: Layers,
                title: "Batch Variant Generation",
                desc: "One structure. Dozens of variations. Test hooks, CTAs, voiceovers, and music at scale.",
                color: "#F43F5E",
              },
              {
                icon: Share2,
                title: "Multi-Platform Export",
                desc: "Export for TikTok, Reels, Shorts, and Stories with auto-generated captions.",
                color: "#A855F7",
                span: "",
              },
              {
                icon: BarChart3,
                title: "Performance Analytics",
                desc: "Track which structures, hook types, and CTA patterns drive the highest ROAS.",
                color: "#F59E0B",
              },
            ].map((feature, i) => (
              <Reveal key={feature.title} delay={i * 80} className={feature.span || ""}>
                <div className="group h-full rounded-xl border border-white/[0.04] bg-white/[0.015] p-6 transition-all duration-300 hover:border-white/[0.08] hover:bg-white/[0.03] hover:-translate-y-1">
                  <div
                    className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: `${feature.color}12`, color: feature.color }}
                  >
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/35">{feature.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section id="how-it-works" className="scroll-mt-20 py-24 sm:py-32 border-t border-white/[0.04] relative">
        {/* Subtle gradient bg */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#7C3AED]/5 rounded-full blur-[150px]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center mb-16">
              <span className="text-sm font-semibold uppercase tracking-widest text-[#7C3AED]">
                How it Works
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                Three steps. First video
                <br />
                <span className="text-white/40">in under 10 minutes.</span>
              </h2>
            </div>
          </Reveal>

          <div className="grid gap-6 md:grid-cols-3 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-20 left-[calc(33.3%_-_12px)] right-[calc(33.3%_-_12px)] h-px bg-gradient-to-r from-[#7C3AED]/30 via-[#A855F7]/20 to-[#A3E635]/30" />

            {[
              {
                n: "1",
                title: "Fork",
                desc: "Paste any viral TikTok or Instagram URL. AI breaks it down into structural components: hook type, scene count, pacing rhythm, audio pattern.",
                visual: (
                  <div className="space-y-2 mt-5">
                    <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-white/30">
                      <GitFork className="h-3.5 w-3.5 text-[#7C3AED]" />
                      <span className="truncate">tiktok.com/@brand/video/73...</span>
                    </div>
                    <div className="flex gap-1.5">
                      {["Hook", "Problem", "Reveal", "CTA"].map((s, i) => (
                        <div
                          key={s}
                          className="flex-1 rounded bg-[#7C3AED]/10 px-2 py-1.5 text-[10px] text-[#A855F7] text-center font-medium animate-fade-in-stagger"
                          style={{ animationDelay: `${i * 150}ms` }}
                        >
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              },
              {
                n: "2",
                title: "Customize",
                desc: "Swap in your product footage, brand colors, and messaging. AI generates a script that follows the proven structure.",
                visual: (
                  <div className="space-y-2 mt-5">
                    {["Product shots", "Brand identity", "AI voiceover"].map((item) => (
                      <div key={item} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-white/30">
                        <div className="w-3 h-3 rounded bg-[#A3E635]/20" />
                        {item}
                        <Check className="h-3 w-3 ml-auto text-[#A3E635]" />
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                n: "3",
                title: "Ship",
                desc: "Export in every format. Generate batch variants to A/B test. Push directly to your ad platforms.",
                visual: (
                  <div className="space-y-2 mt-5">
                    {[
                      { label: "TikTok Ad", status: "Exported" },
                      { label: "Instagram Reels", status: "Exported" },
                      { label: "YouTube Shorts", status: "Ready" },
                    ].map(({ label, status }) => (
                      <div key={label} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs">
                        <span className="text-white/30">{label}</span>
                        <span className="text-[10px] text-[#A3E635] font-medium">{status}</span>
                      </div>
                    ))}
                  </div>
                ),
              },
            ].map((step, i) => (
              <Reveal key={step.n} delay={i * 150}>
                <div className="relative rounded-xl border border-white/[0.04] bg-white/[0.015] p-6 transition-all hover:border-white/[0.08] hover:bg-white/[0.03]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#7C3AED]/10 text-lg font-bold text-[#7C3AED]">
                    {step.n}
                  </div>
                  <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm text-white/35 leading-relaxed">{step.desc}</p>
                  {step.visual}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========== WHY CLIPFORK ========== */}
      <section className="py-24 sm:py-32 border-t border-white/[0.04]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center mb-16">
              <span className="text-sm font-semibold uppercase tracking-widest text-[#7C3AED]">
                Why ClipFork
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                Stop guessing what content to make.
              </h2>
            </div>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { without: "Staring at a blank timeline, hoping your hook works", withCf: "Reverse-engineering hooks from videos with millions of views" },
              { without: "Paying $500+ per UGC creator video", withCf: "Generating unlimited variants for a flat monthly fee" },
              { without: "Spending 4+ hours editing a single 30s ad", withCf: "Going from URL to finished video in under 10 minutes" },
              { without: "Testing 3 creatives per week and burning budget", withCf: "Testing 30+ variants per week with proven structures" },
              { without: "Manually studying competitor ads with no system", withCf: "AI-powered format analysis with automated monitoring" },
              { without: "Recycling the same tired templates everyone uses", withCf: "Forking fresh formats from today's top-performing posts" },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-5 transition-all hover:border-white/[0.08]">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-white/[0.04] flex items-center justify-center shrink-0">
                      <span className="text-[10px] text-white/20">✕</span>
                    </div>
                    <p className="text-sm text-white/25 line-through decoration-white/10">{item.without}</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-[#A3E635]/10 flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-[#A3E635]" />
                    </div>
                    <p className="text-sm text-white/60">{item.withCf}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========== PRICING ========== */}
      <section id="pricing" className="scroll-mt-20 py-24 sm:py-32 border-t border-white/[0.04] relative">
        <div className="absolute inset-0 -z-10">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#7C3AED]/3 rounded-full blur-[150px]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center mb-16">
              <span className="text-sm font-semibold uppercase tracking-widest text-[#7C3AED]">
                Pricing
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Simple pricing. Start free.
              </h2>
              <p className="mt-4 text-white/35">
                No credit card required. 7-day money-back guarantee on all paid plans.
              </p>
            </div>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                name: "Free",
                price: "$0",
                desc: "Test the waters",
                features: ["3 video forks/month", "Basic analysis", "720p export", "Watermarked"],
                highlighted: false,
              },
              {
                name: "Starter",
                price: "$29",
                desc: "Solo founders",
                features: ["20 forks/month", "Full viral cloning", "AI scripts", "1080p, no watermark", "3 batch variants"],
                highlighted: false,
              },
              {
                name: "Growth",
                price: "$79",
                desc: "Growing brands",
                badge: "Popular",
                features: ["80 forks/month", "Everything in Starter", "4K export", "15 batch variants", "Analytics", "3 workspaces"],
                highlighted: true,
              },
              {
                name: "Scale",
                price: "$199",
                desc: "Agencies",
                features: ["Unlimited forks", "Everything in Growth", "API access", "Unlimited workspaces", "Dedicated manager"],
                highlighted: false,
              },
            ].map((plan, i) => (
              <Reveal key={plan.name} delay={i * 100}>
                <div className={`relative flex flex-col rounded-xl border p-6 h-full transition-all duration-300 hover:-translate-y-1 ${
                  plan.highlighted
                    ? "border-[#7C3AED]/40 bg-[#7C3AED]/[0.04] shadow-lg shadow-[#7C3AED]/10"
                    : "border-white/[0.04] bg-white/[0.015] hover:border-white/[0.08]"
                }`}>
                  {plan.badge && (
                    <div className="absolute -top-2.5 left-4 rounded-md bg-[#7C3AED] px-2.5 py-0.5 text-[10px] font-bold text-white">
                      {plan.badge}
                    </div>
                  )}
                  <h3 className="text-base font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-xs text-white/25">{plan.desc}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold">{plan.price}</span>
                    <span className="text-sm text-white/25">/mo</span>
                  </div>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7C3AED]" />
                        <span className="text-white/40">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/sign-up"
                    className={`mt-6 block rounded-lg py-2.5 text-center text-sm font-medium transition-all ${
                      plan.highlighted
                        ? "bg-[#7C3AED] text-white hover:bg-[#6D28D9] shadow-lg shadow-[#7C3AED]/20"
                        : "bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
                    }`}
                  >
                    Start free
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========== FAQ ========== */}
      <section id="faq" className="scroll-mt-20 py-24 sm:py-32 border-t border-white/[0.04]">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-12">
              <span className="text-sm font-semibold uppercase tracking-widest text-[#7C3AED]">FAQ</span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Questions? Answers.
              </h2>
            </div>
          </Reveal>

          <div className="space-y-3">
            {[
              { q: "Is it legal to clone a viral video's structure?", a: "ClipFork does not copy or download any original content. It analyzes structural patterns — timing, pacing, hook placement, transition types — and creates a blueprint. You produce entirely new content with your own assets and voice. This is what every ad creative team does manually. ClipFork automates the analysis." },
              { q: "How is this different from template tools or AI video generators?", a: "Template tools give you generic layouts. AI generators create content from scratch and hope it works. ClipFork starts from structures proven to drive engagement. Instead of guessing what format might work, you reverse-engineer what already works and rebuild it with your brand." },
              { q: "Which platforms are supported?", a: "ClipFork currently supports TikTok and Instagram Reels URLs. We analyze publicly available videos to extract structural patterns. YouTube Shorts support is on the roadmap." },
              { q: "Do I need video editing skills?", a: "No. ClipFork handles structural analysis, asset placement, timing, and export automatically. If you can paste a URL and upload a product photo, you can use ClipFork." },
              { q: "What if the forked video doesn't perform?", a: "That's what batch variants are for. Generate 10-50 variations with different hooks, CTAs, and voiceovers. Test them and let the data pick the winner. The structure is proven — variant testing finds the right execution for your audience." },
            ].map((faq, i) => (
              <Reveal key={i} delay={i * 60}>
                <details className="group rounded-xl border border-white/[0.04] bg-white/[0.015] transition-all hover:border-white/[0.08] [&[open]]:border-[#7C3AED]/20 [&[open]]:bg-[#7C3AED]/[0.02]">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 p-5 text-left text-sm font-medium [&::-webkit-details-marker]:hidden list-none">
                    {faq.q}
                    <ChevronDown className="h-4 w-4 shrink-0 text-white/20 transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <div className="px-5 pb-5">
                    <p className="text-sm text-white/35 leading-relaxed">{faq.a}</p>
                  </div>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========== FINAL CTA ========== */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal direction="scale">
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] px-8 py-16 sm:px-16 sm:py-24 text-center">
              {/* Animated bg */}
              <div className="absolute inset-0 -z-10">
                <div className="absolute inset-0 bg-gradient-to-br from-[#1E1B4B] via-[#0C0C14] to-[#050507]" />
                <div className="absolute top-0 right-[20%] w-[400px] h-[400px] bg-[#7C3AED]/15 rounded-full blur-[120px] animate-float-slow" />
                <div className="absolute bottom-0 left-[20%] w-[300px] h-[300px] bg-[#A3E635]/8 rounded-full blur-[100px] animate-float-slow-reverse" />
              </div>

              <h2 className="mx-auto max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl leading-tight">
                Your competitors study viral ads manually.
                <br />
                <span className="text-white/40">Fork them automatically.</span>
              </h2>

              <div className="mt-10">
                <Link
                  href="/sign-up"
                  className="group relative inline-flex items-center gap-2 rounded-xl bg-[#A3E635] px-8 py-4 text-base font-bold text-[#050507] overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#A3E635]/20"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Start forking free
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </div>

              <p className="mt-6 text-sm text-white/25">
                Free plan. No credit card. First video in under 10 minutes.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-white/[0.04] py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#7C3AED]">
                <GitFork className="h-3 w-3 text-white" />
              </div>
              <span className="text-sm font-bold">
                Clip<span className="text-[#A3E635]">Fork</span>
              </span>
            </div>

            <div className="flex items-center gap-6 text-sm text-white/25">
              <Link href="/terms" className="hover:text-white/60 transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy</Link>
            </div>

            <p className="text-sm text-white/15">
              &copy; {new Date().getFullYear()} ClipFork
            </p>
          </div>
        </div>
      </footer>

      {/* ========== CSS ANIMATIONS ========== */}
      <style dangerouslySetInnerHTML={{ __html: `
        html { scroll-behavior: smooth; }

        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }

        @keyframes progress {
          0% { width: 0; }
          100% { width: 75%; }
        }

        @keyframes gradient-x {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .animate-scan {
          animation: scan 3s ease-in-out infinite;
        }

        .animate-progress {
          animation: progress 3s ease-out forwards;
        }

        .animate-gradient-x {
          animation: gradient-x 6s ease infinite;
        }

        .animate-bounce-slow {
          animation: bounce 3s ease-in-out infinite;
        }

        .animate-fade-in {
          animation: fadeIn 0.8s ease-out forwards;
        }

        .animate-fade-in-up {
          opacity: 0;
          animation: fadeInUp 0.8s ease-out 0.2s forwards;
        }

        .animate-fade-in-up-delay {
          opacity: 0;
          animation: fadeInUp 0.8s ease-out 0.4s forwards;
        }

        .animate-fade-in-up-delay-2 {
          opacity: 0;
          animation: fadeInUp 0.8s ease-out 0.6s forwards;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(8px); }
        }
      `}} />
    </div>
  );
}
