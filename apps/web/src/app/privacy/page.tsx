import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — ClipFork",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#18181B]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
          &larr; Back to ClipFork
        </Link>

        <h1 className="mt-8 text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: March 14, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-zinc-700">
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">1. Introduction</h2>
            <p className="mt-2">
              ClipFork (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) respects your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform at clipfork.app (&quot;the Service&quot;).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">2. Information We Collect</h2>
            <p className="mt-2 font-medium">Information you provide:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Account information (name, email address) via our authentication provider Clerk</li>
              <li>Payment information processed securely through Stripe</li>
              <li>Content you upload (images, videos, brand assets)</li>
              <li>Product URLs and brand information you provide for video generation</li>
              <li>TikTok account information when you connect via OAuth</li>
            </ul>
            <p className="mt-4 font-medium">Information collected automatically:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Usage data (features used, videos created, templates accessed)</li>
              <li>Device and browser information</li>
              <li>IP address and approximate location</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">3. How We Use Your Information</h2>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>To provide and maintain the Service</li>
              <li>To process your transactions and manage your subscription</li>
              <li>To analyze viral video structures and generate content on your behalf</li>
              <li>To monitor competitors and trends as configured by you</li>
              <li>To communicate with you about your account, updates, and support</li>
              <li>To improve and optimize the Service</li>
              <li>To detect and prevent fraud or abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">4. Third-Party Services</h2>
            <p className="mt-2">We use the following third-party services to operate the platform:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><strong>Clerk</strong> — authentication and user management</li>
              <li><strong>Stripe</strong> — payment processing</li>
              <li><strong>Cloudflare R2</strong> — file storage</li>
              <li><strong>OpenRouter</strong> — AI model routing for script generation and video analysis</li>
              <li><strong>ElevenLabs</strong> — voice generation</li>
              <li><strong>TikTok API</strong> — account connection and content publishing</li>
              <li><strong>Vercel</strong> — hosting and deployment</li>
              <li><strong>Supabase</strong> — database hosting</li>
            </ul>
            <p className="mt-2">
              Each third-party service has its own privacy policy governing the data they process. We encourage you to review their policies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">5. Data Storage and Security</h2>
            <p className="mt-2">
              Your data is stored securely using industry-standard encryption. Uploaded files are stored in Cloudflare R2 with access controls. Database connections use TLS encryption. Authentication tokens are encrypted using AES-256-GCM. We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">6. Data Retention</h2>
            <p className="mt-2">
              We retain your account data for as long as your account is active. Uploaded content and generated videos are retained until you delete them or close your account. After account deletion, we will remove your data within 30 days, except where retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">7. Your Rights</h2>
            <p className="mt-2">Depending on your jurisdiction, you may have the right to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your data in a portable format</li>
              <li>Object to or restrict certain processing</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>
            <p className="mt-2">
              To exercise these rights, contact us at privacy@clipfork.app.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">8. Cookies</h2>
            <p className="mt-2">
              We use essential cookies for authentication and session management. We do not use third-party advertising cookies. You can control cookies through your browser settings, though disabling essential cookies may prevent the Service from functioning properly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">9. Children&apos;s Privacy</h2>
            <p className="mt-2">
              The Service is not intended for users under the age of 16. We do not knowingly collect information from children under 16. If we become aware that we have collected data from a child under 16, we will take steps to delete that information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">10. Changes to This Policy</h2>
            <p className="mt-2">
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page and updating the &quot;Last updated&quot; date. Continued use of the Service after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">11. Contact Us</h2>
            <p className="mt-2">
              For privacy-related questions or requests, contact us at privacy@clipfork.app.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
