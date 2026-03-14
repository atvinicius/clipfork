import Link from "next/link";

export const metadata = {
  title: "Terms of Service — ClipFork",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#18181B]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
          &larr; Back to ClipFork
        </Link>

        <h1 className="mt-8 text-3xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: March 14, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-zinc-700">
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">1. Acceptance of Terms</h2>
            <p className="mt-2">
              By accessing or using ClipFork (&quot;the Service&quot;), operated by ClipFork (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">2. Description of Service</h2>
            <p className="mt-2">
              ClipFork is an AI-powered platform that helps users analyze viral video content structures and generate scripts, templates, and assets for creating original video content. The Service includes video structure analysis, script generation, competitor monitoring, and content management tools.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">3. User Accounts</h2>
            <p className="mt-2">
              You must create an account to use the Service. You are responsible for maintaining the security of your account credentials. You must provide accurate and complete information during registration. You are responsible for all activity that occurs under your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">4. Acceptable Use</h2>
            <p className="mt-2">You agree not to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Use the Service to infringe on any third party&apos;s intellectual property rights</li>
              <li>Upload or distribute malicious content, malware, or harmful code</li>
              <li>Attempt to gain unauthorized access to the Service or its systems</li>
              <li>Use the Service to create content that is illegal, defamatory, or violates any applicable laws</li>
              <li>Resell, redistribute, or sublicense access to the Service without our written consent</li>
              <li>Use automated means to access the Service beyond the provided APIs</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">5. Content Ownership</h2>
            <p className="mt-2">
              You retain ownership of content you create using the Service. By using the Service, you grant us a limited license to process your content as necessary to provide the Service. We do not claim ownership of your original content, scripts, or videos generated through the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">6. Third-Party Content</h2>
            <p className="mt-2">
              The Service may analyze publicly available third-party content for structural patterns. Users are solely responsible for ensuring their use of generated content complies with all applicable copyright, trademark, and intellectual property laws. ClipFork does not encourage or condone the direct copying of third-party content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">7. Payments and Subscriptions</h2>
            <p className="mt-2">
              Paid features are billed on a recurring monthly basis. You may cancel your subscription at any time through your account settings. Refunds are handled on a case-by-case basis. We reserve the right to change pricing with 30 days&apos; notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">8. API and Platform Integrations</h2>
            <p className="mt-2">
              The Service integrates with third-party platforms including TikTok and Instagram. Your use of these integrations is subject to the respective platform&apos;s terms of service. We are not responsible for changes to third-party APIs or platforms that may affect Service functionality.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">9. Limitation of Liability</h2>
            <p className="mt-2">
              The Service is provided &quot;as is&quot; without warranties of any kind. We shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service. Our total liability shall not exceed the amount you paid for the Service in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">10. Termination</h2>
            <p className="mt-2">
              We may suspend or terminate your account if you violate these terms. You may delete your account at any time. Upon termination, your right to use the Service ceases immediately, and we may delete your data after a reasonable retention period.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">11. Changes to Terms</h2>
            <p className="mt-2">
              We may update these terms from time to time. We will notify users of material changes via email or through the Service. Continued use of the Service after changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">12. Contact</h2>
            <p className="mt-2">
              For questions about these Terms of Service, contact us at support@clipfork.app.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
