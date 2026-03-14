import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Zap,
  FileText,
  ImagePlus,
  Layers,
  Share2,
  BarChart3,
  ChevronDown,
  ArrowRight,
  Check,
  GitFork,
  Sparkles,
  Music,
  Eye,
  Timer,
  Type,
  Palette,
  MonitorPlay,
} from "lucide-react";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white overflow-x-hidden">
      {/* ========== NAVBAR ========== */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0A0A0F]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7C3AED]">
                <GitFork className="h-4 w-4 text-white" />
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
                  className="text-sm text-white/50 hover:text-white transition-colors"
                >
                  {item}
                </a>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/sign-in"
                className="hidden sm:inline-flex text-sm text-white/60 hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#7C3AED] px-4 py-2 text-sm font-medium text-white hover:bg-[#6D28D9] transition-colors"
              >
                Start free
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ========== HERO ========== */}
      <section className="relative pt-32 pb-20 sm:pt-44 sm:pb-32">
        {/* Gradient orbs */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] bg-[#7C3AED]/15 rounded-full blur-[120px]" />
          <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] bg-[#A3E635]/8 rounded-full blur-[100px]" />
          <div className="absolute top-[5%] left-[50%] w-[300px] h-[300px] bg-[#06B6D4]/8 rounded-full blur-[80px]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#7C3AED]/30 bg-[#7C3AED]/10 px-4 py-1.5 text-sm text-[#A3E635]">
              <Sparkles className="h-3.5 w-3.5" />
              Reverse-engineer virality. One paste away.
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl leading-[1.1]">
              Fork any viral video.
              <br />
              <span className="bg-gradient-to-r from-[#7C3AED] via-[#A855F7] to-[#A3E635] bg-clip-text text-transparent">
                Ship your version
              </span>{" "}
              in minutes.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/50 leading-relaxed">
              Paste a TikTok or Instagram URL. ClipFork deconstructs the viral
              structure — hooks, pacing, transitions, music cues — and rebuilds
              it with your product, your brand, your voice.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/sign-up"
                className="group inline-flex items-center gap-2 rounded-lg bg-[#7C3AED] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[#7C3AED]/25 hover:bg-[#6D28D9] transition-all hover:shadow-[#7C3AED]/40"
              >
                Start forking free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <span className="text-sm text-white/30">
                No credit card required
              </span>
            </div>
          </div>

          {/* ========== PRODUCT MOCKUP ========== */}
          <div className="mx-auto mt-20 max-w-5xl">
            <div className="relative rounded-2xl border border-white/10 bg-[#111118] p-1 shadow-2xl shadow-[#7C3AED]/10">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="mx-auto max-w-md rounded-md bg-white/5 px-4 py-1.5 text-xs text-white/30 text-center">
                    clipfork.app/clone
                  </div>
                </div>
              </div>

              {/* App content mockup */}
              <div className="p-6 sm:p-8">
                {/* URL input area */}
                <div className="mb-8">
                  <div className="text-sm font-medium text-white/40 mb-3">
                    STEP 1 — Paste viral URL
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                      <GitFork className="h-4 w-4 text-[#7C3AED] shrink-0" />
                      <span className="text-sm text-white/60 truncate">
                        https://www.tiktok.com/@brand/video/7349281...
                      </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-[#7C3AED] px-5 py-3 text-sm font-medium shrink-0">
                      <Zap className="h-4 w-4" />
                      Analyze
                    </div>
                  </div>
                </div>

                {/* Analysis result mockup */}
                <div className="grid gap-6 sm:grid-cols-5">
                  {/* Video preview */}
                  <div className="sm:col-span-2">
                    <div className="aspect-[9/16] max-h-[320px] rounded-xl bg-gradient-to-br from-[#1E1B4B] to-[#7C3AED]/40 border border-white/10 flex flex-col items-center justify-center gap-3 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <MonitorPlay className="h-10 w-10 text-white/30 relative z-10" />
                      <span className="text-xs text-white/30 relative z-10">
                        Source video
                      </span>
                      {/* Fake engagement overlay */}
                      <div className="absolute bottom-3 left-3 right-3 z-10">
                        <div className="flex items-center gap-2 text-[10px] text-white/50">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            2.4M
                          </span>
                          <span>·</span>
                          <span>Skincare</span>
                          <span>·</span>
                          <span>0:28</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Scene breakdown */}
                  <div className="sm:col-span-3 space-y-3">
                    <div className="text-sm font-medium text-white/40 mb-1">
                      STRUCTURE ANALYSIS
                    </div>
                    {[
                      {
                        time: "0:00–0:03",
                        type: "Hook",
                        desc: "Pattern interrupt — question overlay with zoom",
                        color: "#F43F5E",
                      },
                      {
                        time: "0:03–0:08",
                        type: "Problem",
                        desc: "Pain point with b-roll + text overlay",
                        color: "#F59E0B",
                      },
                      {
                        time: "0:08–0:16",
                        type: "Solution",
                        desc: "Product reveal with unboxing footage",
                        color: "#7C3AED",
                      },
                      {
                        time: "0:16–0:22",
                        type: "Proof",
                        desc: "Before/after with trending audio drop",
                        color: "#06B6D4",
                      },
                      {
                        time: "0:22–0:28",
                        type: "CTA",
                        desc: "Urgency close with link-in-bio callout",
                        color: "#A3E635",
                      },
                    ].map((scene) => (
                      <div
                        key={scene.type}
                        className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3"
                      >
                        <div
                          className="mt-0.5 w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: scene.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-white/30 font-mono">
                              {scene.time}
                            </span>
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={{
                                backgroundColor: `${scene.color}20`,
                                color: scene.color,
                              }}
                            >
                              {scene.type}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-white/50 truncate">
                            {scene.desc}
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* Detected elements row */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {[
                        { icon: Music, label: "Trending audio" },
                        { icon: Type, label: "Text overlays" },
                        { icon: Timer, label: "Fast pacing" },
                        { icon: Palette, label: "Color grading" },
                      ].map(({ icon: Icon, label }) => (
                        <div
                          key={label}
                          className="flex items-center gap-1.5 rounded-md border border-white/5 bg-white/[0.03] px-2.5 py-1.5 text-[10px] text-white/40"
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

            {/* Glow effect under the mockup */}
            <div className="relative">
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[80%] h-40 bg-[#7C3AED]/10 rounded-full blur-[80px]" />
            </div>
          </div>
        </div>
      </section>

      {/* ========== FEATURES ========== */}
      <section id="features" className="scroll-mt-20 py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <span className="text-sm font-semibold uppercase tracking-widest text-[#7C3AED]">
              Features
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Turn proven virality into
              <br />
              your next winning ad.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<GitFork className="h-5 w-5" />}
              title="Viral Structure Cloning"
              description="Paste any TikTok or IG URL. AI deconstructs hook timing, scene transitions, text overlays, pacing, and music cues into a frame-by-frame blueprint."
              color="#7C3AED"
            />
            <FeatureCard
              icon={<FileText className="h-5 w-5" />}
              title="AI Script Generation"
              description="Scripts reverse-engineered from formats that already went viral — the hook formula, tension arc, CTA placement — customized for your product."
              color="#A3E635"
            />
            <FeatureCard
              icon={<ImagePlus className="h-5 w-5" />}
              title="Smart Asset Replacement"
              description="Upload your product shots and brand assets. ClipFork maps them into the cloned structure — matching duration, pacing, and overlay timing."
              color="#06B6D4"
            />
            <FeatureCard
              icon={<Layers className="h-5 w-5" />}
              title="Batch Variant Generation"
              description="One structure. Dozens of variations. Test hooks, CTAs, voiceovers, and music at scale to feed your ad accounts the volume they need."
              color="#F43F5E"
            />
            <FeatureCard
              icon={<Share2 className="h-5 w-5" />}
              title="Multi-Platform Export"
              description="Export for TikTok, Reels, Shorts, and Stories with auto-generated captions and hashtags. Push directly to ad managers."
              color="#A855F7"
            />
            <FeatureCard
              icon={<BarChart3 className="h-5 w-5" />}
              title="Performance Analytics"
              description="Track which viral structures, hook types, and CTA patterns drive the highest ROAS across all your variants."
              color="#F59E0B"
            />
          </div>
        </div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section
        id="how-it-works"
        className="scroll-mt-20 py-20 sm:py-32 border-t border-white/5"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <span className="text-sm font-semibold uppercase tracking-widest text-[#7C3AED]">
              How it Works
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Three steps. First video in under 10 minutes.
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <StepCard
              number="1"
              title="Fork"
              description="Paste any viral TikTok or Instagram URL. ClipFork breaks it down into structural components: hook type, scene count, pacing rhythm, text overlay timing, and audio pattern."
              visual={
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/40">
                    <GitFork className="h-3.5 w-3.5 text-[#7C3AED]" />
                    <span className="truncate">
                      tiktok.com/@brand/video/73...
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {["Hook", "Problem", "Reveal", "CTA"].map((s) => (
                      <div
                        key={s}
                        className="flex-1 rounded bg-[#7C3AED]/20 px-2 py-1 text-[10px] text-[#A855F7] text-center"
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              }
            />
            <StepCard
              number="2"
              title="Customize"
              description="Swap in your product footage, brand colors, and messaging. Let AI generate a script that follows the proven structure — or write your own."
              visual={
                <div className="space-y-2">
                  {["Product shots", "Brand colors", "Your voiceover"].map(
                    (item) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/40"
                      >
                        <div className="w-3 h-3 rounded bg-[#A3E635]/30" />
                        {item}
                        <Check className="h-3 w-3 ml-auto text-[#A3E635]" />
                      </div>
                    )
                  )}
                </div>
              }
            />
            <StepCard
              number="3"
              title="Ship"
              description="Export in every format. Generate batch variants to A/B test. Push directly to your ad platforms and double down on the winning structures."
              visual={
                <div className="space-y-2">
                  {[
                    { label: "TikTok Ad", status: "Exported" },
                    { label: "IG Reels", status: "Exported" },
                    { label: "YT Shorts", status: "Ready" },
                  ].map(({ label, status }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                    >
                      <span className="text-white/40">{label}</span>
                      <span className="text-[10px] text-[#A3E635]">
                        {status}
                      </span>
                    </div>
                  ))}
                </div>
              }
            />
          </div>
        </div>
      </section>

      {/* ========== WHY CLIPFORK ========== */}
      <section className="py-20 sm:py-32 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <span className="text-sm font-semibold uppercase tracking-widest text-[#7C3AED]">
              Why ClipFork
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Stop guessing what content to make.
              <br />
              <span className="text-white/40">Start cloning what works.</span>
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <ComparisonCard
              without="Staring at a blank timeline, hoping your hook works"
              withCf="Reverse-engineering hooks from videos with 2M+ views"
            />
            <ComparisonCard
              without="Paying $500+ per UGC creator video"
              withCf="Generating unlimited variants for a flat monthly fee"
            />
            <ComparisonCard
              without="Spending 4+ hours editing a single 30s ad"
              withCf="Going from URL to finished video in under 10 minutes"
            />
            <ComparisonCard
              without="Testing 3 creatives per week and burning budget"
              withCf="Testing 30+ variants per week with proven structures"
            />
            <ComparisonCard
              without="Manually studying competitor ads with no system"
              withCf="AI-powered format analysis with automated monitoring"
            />
            <ComparisonCard
              without="Recycling the same tired templates everyone uses"
              withCf="Forking fresh formats from today's top-performing posts"
            />
          </div>
        </div>
      </section>

      {/* ========== PRICING ========== */}
      <section
        id="pricing"
        className="scroll-mt-20 py-20 sm:py-32 border-t border-white/5"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <span className="text-sm font-semibold uppercase tracking-widest text-[#7C3AED]">
              Pricing
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Simple pricing. Start free. Cancel anytime.
            </h2>
            <p className="mt-4 text-white/40">
              No credit card required. All paid plans include a 7-day
              money-back guarantee.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PricingCard
              name="Free"
              price="$0"
              period="/mo"
              description="Test the waters"
              features={[
                "3 video forks/month",
                "Basic structure analysis",
                "720p export",
                "Watermarked output",
              ]}
              cta="Start free"
              ctaLink="/sign-up"
              highlighted={false}
            />
            <PricingCard
              name="Starter"
              price="$29"
              period="/mo"
              description="Solo founders & small brands"
              features={[
                "20 forks/month",
                "Full viral cloning",
                "AI script generation",
                "1080p export, no watermark",
                "3 batch variants per fork",
                "Email support",
              ]}
              cta="Start free"
              ctaLink="/sign-up"
              highlighted={false}
            />
            <PricingCard
              name="Growth"
              price="$79"
              period="/mo"
              description="Growing brands & agencies"
              badge="Popular"
              features={[
                "80 forks/month",
                "Everything in Starter",
                "4K export",
                "15 batch variants per fork",
                "Multi-platform export",
                "Performance analytics",
                "3 team workspaces",
                "Priority support",
              ]}
              cta="Start free"
              ctaLink="/sign-up"
              highlighted={true}
            />
            <PricingCard
              name="Scale"
              price="$199"
              period="/mo"
              description="High-volume & enterprise"
              features={[
                "Unlimited forks",
                "Everything in Growth",
                "Unlimited batch variants",
                "API access",
                "Unlimited workspaces",
                "Approval workflows",
                "Dedicated account manager",
              ]}
              cta="Start free"
              ctaLink="/sign-up"
              highlighted={false}
            />
          </div>

          <p className="mt-8 text-center text-sm text-white/30">
            All plans billed monthly. Annual billing at 20% off.{" "}
            <a href="#" className="text-[#7C3AED] hover:underline">
              Need a custom plan?
            </a>
          </p>
        </div>
      </section>

      {/* ========== FAQ ========== */}
      <section
        id="faq"
        className="scroll-mt-20 py-20 sm:py-32 border-t border-white/5"
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold uppercase tracking-widest text-[#7C3AED]">
              FAQ
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Questions? Answers.
            </h2>
          </div>

          <div className="space-y-3">
            <FaqItem
              question="Is it legal to clone a viral video's structure?"
              answer="ClipFork does not copy or download any original content. It analyzes structural patterns — timing, pacing, hook placement, transition types — and creates a blueprint. You produce entirely new content with your own assets, scripts, and voice. This is what every ad creative team does manually when studying competitor ads. ClipFork automates the analysis."
            />
            <FaqItem
              question="How is this different from template tools or AI video generators?"
              answer="Template tools give you generic layouts. AI generators create content from scratch and hope it works. ClipFork starts from structures proven to drive engagement. Instead of guessing what format might work, you reverse-engineer what already works and rebuild it with your brand."
            />
            <FaqItem
              question="Which platforms are supported?"
              answer="ClipFork currently supports TikTok and Instagram Reels URLs. We analyze publicly available videos to extract structural patterns. YouTube Shorts support is on the roadmap."
            />
            <FaqItem
              question="Can I use it for organic content, not just ads?"
              answer="Absolutely. Fork viral organic formats to build your TikTok or Instagram presence. Many users fork trending formats for organic posting and boost the winners as paid ads."
            />
            <FaqItem
              question="Do I need video editing skills?"
              answer="No. ClipFork handles structural analysis, asset placement, timing, and export automatically. If you can paste a URL and upload a product photo, you can use ClipFork."
            />
            <FaqItem
              question="What if the forked video doesn't perform?"
              answer="That's what batch variants are for. Generate 10-50 variations of the same viral structure with different hooks, CTAs, and voiceovers. Test them and let the data pick the winner. The structure is proven — variant testing finds the right execution for your audience."
            />
            <FaqItem
              question="Can my team collaborate?"
              answer="Yes. Growth and Scale plans include team workspaces with role-based access, shared template libraries, and approval workflows. Agencies can manage multiple brand accounts from a single dashboard."
            />
          </div>
        </div>
      </section>

      {/* ========== FINAL CTA ========== */}
      <section className="py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1E1B4B] via-[#7C3AED]/30 to-[#0A0A0F] px-8 py-16 sm:px-16 sm:py-24 text-center">
            <div className="absolute inset-0 -z-10">
              <div className="absolute top-0 right-[20%] w-[300px] h-[300px] bg-[#7C3AED]/20 rounded-full blur-[100px]" />
              <div className="absolute bottom-0 left-[20%] w-[200px] h-[200px] bg-[#A3E635]/10 rounded-full blur-[80px]" />
            </div>

            <h2 className="mx-auto max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Your competitors study viral ads manually.
              <br />
              <span className="text-white/50">
                You should be forking them automatically.
              </span>
            </h2>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/sign-up"
                className="group inline-flex items-center gap-2 rounded-lg bg-[#A3E635] px-8 py-4 text-base font-bold text-[#0A0A0F] hover:bg-[#BEF264] transition-colors"
              >
                Start forking free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            <p className="mt-6 text-sm text-white/30">
              Free plan. No credit card. First video in under 10 minutes.
            </p>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-white/5 py-12">
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

            <div className="flex items-center gap-6 text-sm text-white/30">
              <Link
                href="/terms"
                className="hover:text-white transition-colors"
              >
                Terms
              </Link>
              <Link
                href="/privacy"
                className="hover:text-white transition-colors"
              >
                Privacy
              </Link>
            </div>

            <p className="text-sm text-white/20">
              &copy; {new Date().getFullYear()} ClipFork
            </p>
          </div>
        </div>
      </footer>

      <style
        dangerouslySetInnerHTML={{
          __html: `html { scroll-behavior: smooth; }`,
        }}
      />
    </div>
  );
}

/* ========== COMPONENTS ========== */

function FeatureCard({
  icon,
  title,
  description,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="group rounded-xl border border-white/5 bg-white/[0.02] p-6 transition-all hover:border-white/10 hover:bg-white/[0.04]">
      <div
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/40">
        {description}
      </p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
  visual,
}: {
  number: string;
  title: string;
  description: string;
  visual: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#7C3AED]/10 text-lg font-bold text-[#7C3AED]">
        {number}
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm text-white/40 leading-relaxed">
        {description}
      </p>
      <div className="mt-5">{visual}</div>
    </div>
  );
}

function ComparisonCard({
  without,
  withCf,
}: {
  without: string;
  withCf: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="mt-1 w-4 h-4 rounded-full bg-white/5 flex items-center justify-center shrink-0">
          <span className="text-[8px] text-white/30">✕</span>
        </div>
        <p className="text-sm text-white/30 line-through decoration-white/10">
          {without}
        </p>
      </div>
      <div className="flex items-start gap-3">
        <div className="mt-1 w-4 h-4 rounded-full bg-[#A3E635]/10 flex items-center justify-center shrink-0">
          <Check className="h-2.5 w-2.5 text-[#A3E635]" />
        </div>
        <p className="text-sm text-white/70">{withCf}</p>
      </div>
    </div>
  );
}

function PricingCard({
  name,
  price,
  period,
  description,
  badge,
  features,
  cta,
  ctaLink,
  highlighted,
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  badge?: string;
  features: string[];
  cta: string;
  ctaLink: string;
  highlighted: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-xl border p-6 ${
        highlighted
          ? "border-[#7C3AED]/50 bg-[#7C3AED]/5 ring-1 ring-[#7C3AED]/20"
          : "border-white/5 bg-white/[0.02]"
      }`}
    >
      {badge && (
        <div className="absolute -top-2.5 left-4 rounded bg-[#7C3AED] px-2.5 py-0.5 text-[10px] font-bold text-white">
          {badge}
        </div>
      )}
      <h3 className="text-base font-semibold">{name}</h3>
      <p className="mt-1 text-xs text-white/30">{description}</p>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-extrabold">{price}</span>
        <span className="text-sm text-white/30">{period}</span>
      </div>
      <ul className="mt-5 flex-1 space-y-2.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7C3AED]" />
            <span className="text-white/50">{feature}</span>
          </li>
        ))}
      </ul>
      <Link
        href={ctaLink}
        className={`mt-6 block rounded-lg py-2.5 text-center text-sm font-medium transition-colors ${
          highlighted
            ? "bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
            : "bg-white/5 text-white/70 hover:bg-white/10"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  return (
    <details className="group rounded-xl border border-white/5 bg-white/[0.02] transition-all hover:border-white/10 [&[open]]:border-white/10">
      <summary className="flex cursor-pointer items-center justify-between gap-4 p-5 text-left text-sm font-medium [&::-webkit-details-marker]:hidden list-none">
        {question}
        <ChevronDown className="h-4 w-4 shrink-0 text-white/30 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-5">
        <p className="text-sm text-white/40 leading-relaxed">{answer}</p>
      </div>
    </details>
  );
}
