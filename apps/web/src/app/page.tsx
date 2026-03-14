import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Zap,
  FileText,
  ImagePlus,
  UserCircle,
  Layers,
  Share2,
  BarChart3,
  Users,
  ChevronDown,
  Play,
  ArrowRight,
  Check,
  Star,
  Clock,
  TrendingUp,
} from "lucide-react";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#18181B] overflow-x-hidden">
      {/* ========== STICKY NAVBAR ========== */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#A3E635]">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-[#18181B]">
                ClipFork
              </span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-sm font-medium text-[#64748B] hover:text-[#7C3AED] transition-colors"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="text-sm font-medium text-[#64748B] hover:text-[#7C3AED] transition-colors"
              >
                How it Works
              </a>
              <a
                href="#pricing"
                className="text-sm font-medium text-[#64748B] hover:text-[#7C3AED] transition-colors"
              >
                Pricing
              </a>
              <a
                href="#faq"
                className="text-sm font-medium text-[#64748B] hover:text-[#7C3AED] transition-colors"
              >
                FAQ
              </a>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/sign-in"
                className="hidden sm:inline-flex text-sm font-medium text-[#64748B] hover:text-[#18181B] transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#7C3AED] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[#7C3AED]/25 hover:bg-[#6D28D9] transition-all hover:shadow-[#7C3AED]/40 hover:-translate-y-0.5"
              >
                Start Free
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ========== HERO SECTION ========== */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
        {/* Background gradient accent */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[600px] bg-gradient-to-br from-[#7C3AED]/10 via-[#A3E635]/5 to-transparent rounded-b-[50%] blur-3xl" />
          <div className="absolute top-20 right-0 w-96 h-96 bg-[#7C3AED]/5 rounded-full blur-3xl animate-[pulse_8s_ease-in-out_infinite]" />
          <div className="absolute top-40 left-0 w-72 h-72 bg-[#A3E635]/5 rounded-full blur-3xl animate-[pulse_10s_ease-in-out_infinite]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#7C3AED]/20 bg-[#EDE9FE] px-4 py-1.5 text-sm font-medium text-[#7C3AED]">
              <Zap className="h-3.5 w-3.5" />
              AI-Powered Viral Video Cloning
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl">
              Fork any viral video.{" "}
              <span className="bg-gradient-to-r from-[#7C3AED] to-[#A3E635] bg-clip-text text-transparent">
                Ship your version
              </span>{" "}
              in minutes.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#64748B] sm:text-xl">
              Paste a TikTok or Instagram URL. ClipFork&apos;s AI deconstructs
              the viral structure — hooks, pacing, transitions, CTAs — and
              rebuilds it with your product, your brand, your voice. No filming.
              No editing. No guessing what works.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/sign-up"
                className="group inline-flex items-center gap-2 rounded-full bg-[#7C3AED] px-8 py-4 text-base font-semibold text-white shadow-xl shadow-[#7C3AED]/30 hover:bg-[#6D28D9] transition-all hover:shadow-[#7C3AED]/50 hover:-translate-y-0.5"
              >
                Start forking free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <button className="group inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-8 py-4 text-base font-semibold text-[#18181B] shadow-sm hover:border-[#7C3AED]/30 hover:shadow-md transition-all">
                <Play className="h-4 w-4 text-[#7C3AED]" />
                Watch it work (2 min demo)
              </button>
            </div>

            {/* Social proof bar */}
            <div className="mt-16 flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-8">
              <div className="flex items-center gap-2 text-sm text-[#64748B]">
                <div className="flex -space-x-2">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-[#7C3AED] to-[#A3E635] text-[10px] font-bold text-white"
                    >
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                </div>
                <span className="font-medium">
                  Trusted by 400+ DTC brands and agencies
                </span>
              </div>
              <div className="hidden sm:block h-4 w-px bg-gray-300" />
              <span className="text-sm font-medium text-[#64748B]">
                12,000+ videos forked
              </span>
              <div className="hidden sm:block h-4 w-px bg-gray-300" />
              <span className="text-sm font-medium text-[#64748B]">
                Avg 2.4x ROAS lift
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FEATURES SECTION ========== */}
      <section id="features" className="scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-[#7C3AED]">
              Features
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Everything you need to turn proven virality into your next winning
              ad.
            </h2>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Feature 1 */}
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="Viral Structure Cloning"
              subtitle="Paste a URL. Get the blueprint."
              description="Drop any viral TikTok or Instagram video URL into ClipFork. Our AI analyzes the hook timing, scene transitions, text overlay placement, CTA positioning, pacing, and music cues. You get a frame-by-frame structural blueprint you can rebuild with your own assets — in minutes, not days."
              color="#7C3AED"
            />
            {/* Feature 2 */}
            <FeatureCard
              icon={<FileText className="h-6 w-6" />}
              title="AI Script Generation"
              subtitle="Scripts that already proved they convert."
              description="ClipFork doesn't write scripts from scratch and hope they work. It reverse-engineers the scripting patterns from videos that already went viral — the hook formula, the tension arc, the CTA placement — and generates new scripts that follow the same structural DNA, customized for your product."
              color="#A3E635"
            />
            {/* Feature 3 */}
            <FeatureCard
              icon={<ImagePlus className="h-6 w-6" />}
              title="Smart Asset Replacement"
              subtitle="Your product. Their proven format."
              description="Upload your product shots, brand assets, and logo. ClipFork intelligently maps them into the cloned structure — matching scene duration, visual pacing, and overlay timing. The output looks native, not templated."
              color="#06B6D4"
            />
            {/* Feature 4 */}
            <FeatureCard
              icon={<UserCircle className="h-6 w-6" />}
              title="AI Avatars & Voice"
              subtitle="200+ AI presenters. Zero scheduling headaches."
              description="Choose from a diverse library of realistic AI avatars or clone your own brand spokesperson. Match voice tone, accent, and energy level to your brand. No more waiting on creators."
              color="#F43F5E"
            />
            {/* Feature 5 */}
            <FeatureCard
              icon={<Layers className="h-6 w-6" />}
              title="Batch Variant Generation"
              subtitle="One structure. Fifty variations. Five minutes."
              description="Test hooks, CTAs, avatars, and scripts at scale. ClipFork generates dozens of creative variants from a single viral structure so you can feed your ad accounts the volume they need."
              color="#7C3AED"
            />
            {/* Feature 6 */}
            <FeatureCard
              icon={<Share2 className="h-6 w-6" />}
              title="Multi-Platform Export"
              subtitle="TikTok, Reels, Shorts, Stories. One click."
              description="Export in every aspect ratio and format. Auto-generate platform-specific captions and hashtags."
              color="#A3E635"
            />
            {/* Feature 7 */}
            <FeatureCard
              icon={<BarChart3 className="h-6 w-6" />}
              title="Performance Analytics"
              subtitle="Know which structures win before you spend."
              description="Track which viral structures, hook types, and CTA patterns drive the highest ROAS across your variants."
              color="#06B6D4"
            />
            {/* Feature 8 */}
            <FeatureCard
              icon={<Users className="h-6 w-6" />}
              title="Team Workspaces"
              subtitle="Built for agencies managing 20 brands, not solo creators."
              description="Separate brand workspaces, shared template libraries, approval workflows, and role-based access."
              color="#F43F5E"
            />
          </div>
        </div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section
        id="how-it-works"
        className="scroll-mt-20 py-20 sm:py-28 bg-gradient-to-b from-[#EDE9FE]/40 to-[#FAFAFA]"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-[#7C3AED]">
              How it Works
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Three steps. First video in under 10 minutes.
            </h2>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {/* Step 1 */}
            <div className="group relative rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#7C3AED]/80 text-2xl font-extrabold text-white shadow-lg shadow-[#7C3AED]/20">
                1
              </div>
              <h3 className="text-xl font-bold text-[#18181B]">Fork</h3>
              <p className="mt-3 text-[#64748B] leading-relaxed">
                Paste any viral TikTok or Instagram video URL. ClipFork&apos;s AI
                breaks it down into its structural components.
              </p>
            </div>
            {/* Step 2 */}
            <div className="group relative rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A3E635] text-2xl font-extrabold text-white shadow-lg shadow-[#7C3AED]/20">
                2
              </div>
              <h3 className="text-xl font-bold text-[#18181B]">Customize</h3>
              <p className="mt-3 text-[#64748B] leading-relaxed">
                Swap in your product footage, brand colors, logo, and messaging.
                Choose an AI avatar or upload your own.
              </p>
            </div>
            {/* Step 3 */}
            <div className="group relative rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#A3E635] to-[#A3E635]/80 text-2xl font-extrabold text-white shadow-lg shadow-[#A3E635]/20">
                3
              </div>
              <h3 className="text-xl font-bold text-[#18181B]">Ship</h3>
              <p className="mt-3 text-[#64748B] leading-relaxed">
                Export your video in every format. Generate batch variants to A/B
                test. Push directly to your ad platforms.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== SOCIAL PROOF ========== */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-[#7C3AED]">
              Results
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Brands that stopped guessing and started forking.
            </h2>
          </div>

          {/* Metric cards */}
          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
              <TrendingUp className="mx-auto h-8 w-8 text-[#7C3AED] mb-4" />
              <div className="text-4xl font-extrabold bg-gradient-to-r from-[#7C3AED] to-[#A3E635] bg-clip-text text-transparent">
                2.4x
              </div>
              <p className="mt-2 text-[#64748B] font-medium">
                average ROAS improvement
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
              <Clock className="mx-auto h-8 w-8 text-[#7C3AED] mb-4" />
              <div className="text-4xl font-extrabold bg-gradient-to-r from-[#7C3AED] to-[#A3E635] bg-clip-text text-transparent">
                87%
              </div>
              <p className="mt-2 text-[#64748B] font-medium">
                reduction in video production time
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
              <Zap className="mx-auto h-8 w-8 text-[#7C3AED] mb-4" />
              <div className="text-4xl font-extrabold bg-gradient-to-r from-[#7C3AED] to-[#A3E635] bg-clip-text text-transparent">
                12,000+
              </div>
              <p className="mt-2 text-[#64748B] font-medium">
                videos forked and counting
              </p>
            </div>
          </div>

          {/* Testimonials */}
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <TestimonialCard
              quote="We used to spend $15k/month on creative production. Now we fork 50 winning ad structures a week for a fraction of the cost. Our ROAS went from 1.8x to 4.2x."
              name="Sarah Chen"
              title="Head of Growth, Luminary Skincare"
            />
            <TestimonialCard
              quote="ClipFork changed how our agency operates. We manage 22 brands and can spin up ad variants in minutes instead of days. Clients are thrilled with the turnaround."
              name="Marcus Rivera"
              title="Creative Director, Bolt Media Agency"
            />
            <TestimonialCard
              quote="The batch variant feature alone is worth 10x the price. We test 30+ creatives per week now. Our winning rate on new ads went from 8% to 34%."
              name="Priya Patel"
              title="Performance Marketing Lead, NovaBrew"
            />
          </div>
        </div>
      </section>

      {/* ========== PRICING ========== */}
      <section
        id="pricing"
        className="scroll-mt-20 py-20 sm:py-28 bg-gradient-to-b from-[#EDE9FE]/30 to-[#FAFAFA]"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-[#7C3AED]">
              Pricing
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Simple pricing. Cancel anytime. Start free.
            </h2>
            <p className="mt-4 text-lg text-[#64748B]">
              No credit card required on Free. All paid plans include a 7-day
              money-back guarantee.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Free */}
            <PricingCard
              name="Free"
              price="$0"
              period="/mo"
              features={[
                "3 video forks/month",
                "Basic analysis",
                "5 AI avatars",
                "720p export",
                "Watermarked",
                "Community support",
              ]}
              cta="Start free"
              ctaLink="/sign-up"
              highlighted={false}
            />
            {/* Starter */}
            <PricingCard
              name="Starter"
              price="$29"
              period="/mo"
              features={[
                "20 forks/month",
                "Full viral cloning",
                "50+ AI avatars",
                "1080p export",
                "No watermark",
                "AI script generation",
                "3 batch variants",
                "Email support",
              ]}
              cta="Start free"
              ctaLink="/sign-up"
              highlighted={false}
            />
            {/* Growth */}
            <PricingCard
              name="Growth"
              price="$79"
              period="/mo"
              badge="Most Popular"
              features={[
                "80 forks/month",
                "Everything in Starter",
                "200+ AI avatars",
                "Custom avatar upload",
                "4K export",
                "15 batch variants",
                "Multi-platform export",
                "Performance analytics",
                "3 team workspaces",
                "Priority support",
              ]}
              cta="Start free"
              ctaLink="/sign-up"
              highlighted={true}
            />
            {/* Scale */}
            <PricingCard
              name="Scale"
              price="$199"
              period="/mo"
              features={[
                "Unlimited forks",
                "Everything in Growth",
                "Unlimited batch variants",
                "Custom avatar cloning",
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
        </div>
      </section>

      {/* ========== FAQ ========== */}
      <section id="faq" className="scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-[#7C3AED]">
              FAQ
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Questions? We have answers.
            </h2>
          </div>

          <div className="mt-12 space-y-4">
            <FaqItem
              question="Is it legal to clone a viral video's structure?"
              answer="ClipFork does not copy or download any original video content. It analyzes the structural patterns — timing, pacing, hook placement, transition types — and creates an original blueprint. You produce entirely new content using your own assets, scripts, and AI avatars. This is similar to studying a successful ad format and creating your own version, which is standard practice in advertising."
            />
            <FaqItem
              question="How is this different from a standard video editor or template tool?"
              answer="Traditional video editors give you a blank canvas. Template tools give you generic layouts. ClipFork starts with structures that are proven to drive engagement and conversions. Instead of guessing what format might work, you reverse-engineer what already works and rebuild it with your brand. It's the difference between designing from scratch and building on validated foundations."
            />
            <FaqItem
              question="Which platforms and video URLs are supported?"
              answer="ClipFork currently supports TikTok and Instagram Reels URLs. We analyze publicly available videos to extract structural patterns. Support for YouTube Shorts, Facebook Reels, and Pinterest Idea Pins is on our roadmap."
            />
            <FaqItem
              question="How realistic are the AI avatars?"
              answer="Our AI avatar library features over 200 diverse presenters with natural lip-sync, facial expressions, and body language. On paid plans, you can also clone your own brand spokesperson with just a few minutes of reference footage. Most viewers cannot distinguish our AI avatars from real presenters."
            />
            <FaqItem
              question="Can I use ClipFork for organic content, not just ads?"
              answer="Absolutely. While many customers use ClipFork primarily for paid ad creatives, the same viral structures work for organic TikTok, Reels, and Shorts content. Several of our customers use ClipFork to maintain a consistent posting schedule across multiple organic accounts."
            />
            <FaqItem
              question="Do I need video editing skills to use ClipFork?"
              answer="No. ClipFork is designed for marketers, growth teams, and agency managers — not video editors. The AI handles all the technical production work. If you can paste a URL, upload an image, and type a product description, you can use ClipFork."
            />
            <FaqItem
              question="How does ClipFork track performance?"
              answer="The Performance Analytics feature (available on Growth and Scale plans) tracks which viral structures, hook types, and CTA patterns drive the highest ROAS across your ad variants. You can connect your ad accounts to see which structural patterns consistently outperform, helping you make data-driven creative decisions."
            />
            <FaqItem
              question="Can my team collaborate on projects?"
              answer="Yes. Growth and Scale plans include team workspaces with role-based access, shared template libraries, and approval workflows. Agencies can create separate brand workspaces to keep client assets and projects organized. The Scale plan offers unlimited workspaces and a dedicated account manager."
            />
          </div>
        </div>
      </section>

      {/* ========== FINAL CTA ========== */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E1B4B] to-[#7C3AED] px-8 py-16 sm:px-16 sm:py-24 text-center">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#A3E635]/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#06B6D4]/10 rounded-full blur-3xl" />

            <div className="relative z-10">
              <h2 className="mx-auto max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Your competitors are already studying viral ads manually. You
                should be forking them automatically.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-white/70">
                Join 400+ DTC brands and agencies that stopped guessing what
                content to make and started cloning what already works.
              </p>
              <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Link
                  href="/sign-up"
                  className="group inline-flex items-center gap-2 rounded-full bg-[#A3E635] px-8 py-4 text-base font-bold text-[#1E1B4B] shadow-xl hover:bg-[#BEF264] transition-all hover:-translate-y-0.5"
                >
                  Start forking free
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <button className="inline-flex items-center gap-2 rounded-full border border-white/20 px-8 py-4 text-base font-semibold text-white hover:bg-white/10 transition-all">
                  Book a demo
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-gray-100 bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#A3E635]">
                <Zap className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-lg font-bold text-[#18181B]">ClipFork</span>
            </div>

            <div className="flex items-center gap-6 text-sm text-[#64748B]">
              <a href="#" className="hover:text-[#18181B] transition-colors">
                Terms
              </a>
              <a href="#" className="hover:text-[#18181B] transition-colors">
                Privacy
              </a>
              <a
                href="#"
                className="hover:text-[#18181B] transition-colors"
                aria-label="Twitter"
              >
                Twitter
              </a>
              <a
                href="#"
                className="hover:text-[#18181B] transition-colors"
                aria-label="LinkedIn"
              >
                LinkedIn
              </a>
            </div>

            <p className="text-sm text-[#64748B]">
              &copy; {new Date().getFullYear()} ClipFork. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Smooth scroll style */}
      <style
        dangerouslySetInnerHTML={{
          __html: `html { scroll-behavior: smooth; }`,
        }}
      />
    </div>
  );
}

/* ========== COMPONENT HELPERS ========== */

function FeatureCard({
  icon,
  title,
  subtitle,
  description,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  color: string;
}) {
  return (
    <div className="group relative flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1">
      <div
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {icon}
      </div>
      <h3 className="text-lg font-bold text-[#18181B]">{title}</h3>
      <p className="mt-1 text-sm font-semibold text-[#7C3AED]">{subtitle}</p>
      <p className="mt-3 text-sm leading-relaxed text-[#64748B]">
        {description}
      </p>
    </div>
  );
}

function TestimonialCard({
  quote,
  name,
  title,
}: {
  quote: string;
  name: string;
  title: string;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
      <div className="mb-4 flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star
            key={i}
            className="h-4 w-4 fill-[#A3E635] text-[#A3E635]"
          />
        ))}
      </div>
      <p className="flex-1 text-[#18181B] leading-relaxed">
        &ldquo;{quote}&rdquo;
      </p>
      <div className="mt-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A3E635] text-sm font-bold text-white">
          {name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#18181B]">{name}</p>
          <p className="text-xs text-[#64748B]">{title}</p>
        </div>
      </div>
    </div>
  );
}

function PricingCard({
  name,
  price,
  period,
  badge,
  features,
  cta,
  ctaLink,
  highlighted,
}: {
  name: string;
  price: string;
  period: string;
  badge?: string;
  features: string[];
  cta: string;
  ctaLink: string;
  highlighted: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-8 transition-all hover:-translate-y-1 ${
        highlighted
          ? "border-[#7C3AED] bg-white shadow-xl shadow-[#7C3AED]/10 ring-1 ring-[#7C3AED]"
          : "border-gray-100 bg-white shadow-sm hover:shadow-lg"
      }`}
    >
      {badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A3E635] px-4 py-1 text-xs font-bold text-white whitespace-nowrap">
          {badge}
        </div>
      )}
      <h3 className="text-lg font-bold text-[#18181B]">{name}</h3>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-extrabold text-[#18181B]">{price}</span>
        <span className="text-[#64748B]">{period}</span>
      </div>
      <ul className="mt-6 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7C3AED]" />
            <span className="text-[#64748B]">{feature}</span>
          </li>
        ))}
      </ul>
      <Link
        href={ctaLink}
        className={`mt-8 block rounded-full py-3 text-center text-sm font-semibold transition-all ${
          highlighted
            ? "bg-[#7C3AED] text-white shadow-lg shadow-[#7C3AED]/25 hover:bg-[#6D28D9]"
            : "bg-[#18181B] text-white hover:bg-[#27272A]"
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
    <details className="group rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md [&[open]]:shadow-md">
      <summary className="flex cursor-pointer items-center justify-between gap-4 p-6 text-left font-semibold text-[#18181B] [&::-webkit-details-marker]:hidden list-none">
        {question}
        <ChevronDown className="h-5 w-5 shrink-0 text-[#64748B] transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-6 pb-6">
        <p className="text-[#64748B] leading-relaxed">{answer}</p>
      </div>
    </details>
  );
}
