import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/header";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      {
        title: "Terms of Service - QueryStudio",
      },
      {
        name: "description",
        content:
          "QueryStudio Terms of Service - The terms and conditions for using our database management tool.",
      },
    ],
  }),
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 pt-20 pb-16 max-w-4xl">
        <h1 className="text-4xl font-semibold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-12">Last Updated: February 2, 2026</p>

        <div className="prose prose-invert max-w-none">
          <p className="text-lg text-muted-foreground mb-8">
            Welcome to QueryStudio. These Terms of Service ("Terms") govern your use of the
            QueryStudio desktop application and web platform at querystudio.dev (collectively, the
            "Service"). QueryStudio is developed and operated from Denmark.
          </p>

          <p className="text-muted-foreground mb-12">
            By using our Service, you agree to these Terms. If you disagree with any part, please do
            not use the Service.
          </p>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">1. Overview</h2>
            <p className="text-muted-foreground mb-4">
              QueryStudio is a database management and query tool that allows you to:
            </p>
            <ul className="text-muted-foreground">
              <li>Connect to and manage databases (PostgreSQL, MySQL, SQLite, Redis, MongoDB)</li>
              <li>Write and execute database queries</li>
              <li>Browse and edit table data</li>
              <li>Use AI-assisted query generation (with your own API keys)</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">2. Account Registration</h2>

            <h3 className="text-xl font-medium mb-4">2.1 Account Requirements</h3>
            <p className="text-muted-foreground mb-4">
              To access certain features, you must create an account. You agree to:
            </p>
            <ul className="text-muted-foreground mb-6">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Be responsible for all activity under your account</li>
            </ul>

            <h3 className="text-xl font-medium mb-4">2.2 Age Requirement</h3>
            <p className="text-muted-foreground">
              You must be at least 16 years old to use QueryStudio. By creating an account, you
              confirm you meet this requirement.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">3. Subscription Plans and Payments</h2>

            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <div className="bg-muted/20 border rounded-xl p-6">
                <h3 className="text-xl font-medium mb-4">Free Plan</h3>
                <ul className="text-muted-foreground text-sm space-y-2 mb-0">
                  <li>Personal, non-commercial use only</li>
                  <li>Up to 2 simultaneous database connections</li>
                  <li>Access to all supported database types</li>
                  <li>AI assistant (using your own API keys)</li>
                </ul>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
                <h3 className="text-xl font-medium mb-4">Pro Plan</h3>
                <ul className="text-muted-foreground text-sm space-y-2 mb-0">
                  <li>Commercial use permitted</li>
                  <li>Unlimited database connections</li>
                  <li>Priority support</li>
                  <li>All future updates</li>
                </ul>
              </div>
            </div>

            <h3 className="text-xl font-medium mb-4">3.1 Pricing and Billing</h3>
            <ul className="text-muted-foreground mb-6">
              <li>
                <strong className="text-foreground">Monthly subscription:</strong> Billed monthly,
                cancel anytime
              </li>
              <li>
                <strong className="text-foreground">One-time purchase:</strong> Single payment for
                lifetime access
              </li>
            </ul>
            <p className="text-muted-foreground mb-6">
              Prices are displayed on our website and may change with reasonable notice. Existing
              subscriptions will not be affected by price increases during their current billing
              period.
            </p>

            <h3 className="text-xl font-medium mb-4">3.2 Refund Policy</h3>
            <ul className="text-muted-foreground mb-6">
              <li>
                <strong className="text-foreground">One-time purchases:</strong> 14-day refund
                policy from date of purchase
              </li>
              <li>
                <strong className="text-foreground">Monthly subscriptions:</strong> Cancel anytime;
                access continues until the end of your billing period
              </li>
            </ul>
            <p className="text-muted-foreground">
              To request a refund, contact us at{" "}
              <a href="mailto:querystudio@lasse.email" className="text-primary hover:underline">
                querystudio@lasse.email
              </a>
              .
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">4. Acceptable Use</h2>

            <h3 className="text-xl font-medium mb-4">4.1 You May</h3>
            <ul className="text-muted-foreground mb-6">
              <li>
                Use QueryStudio to connect to databases you own or have authorization to access
              </li>
              <li>Use the Service for personal use (Free plan) or commercial use (Pro plan)</li>
              <li>Create queries, manage data, and use AI features as intended</li>
            </ul>

            <h3 className="text-xl font-medium mb-4">4.2 You May Not</h3>
            <ul className="text-muted-foreground mb-6">
              <li>Access databases without proper authorization</li>
              <li>Use the Service for any illegal purpose</li>
              <li>Attempt to reverse engineer, decompile, or disassemble the software</li>
              <li>Circumvent licensing restrictions or usage limits</li>
              <li>Share, transfer, or resell your license to others</li>
              <li>Use the Service to harm, harass, or infringe on the rights of others</li>
              <li>Introduce malware, viruses, or malicious code</li>
              <li>Overload or disrupt our infrastructure</li>
            </ul>

            <h3 className="text-xl font-medium mb-4">4.3 AI Feature Usage</h3>
            <p className="text-muted-foreground mb-4">When using AI features:</p>
            <ul className="text-muted-foreground">
              <li>You are responsible for providing your own AI API keys</li>
              <li>You are subject to the respective AI provider's terms of service</li>
              <li>You are responsible for any costs incurred with AI providers</li>
              <li>AI-generated queries should be reviewed before execution</li>
              <li>We are not responsible for the output or accuracy of AI-generated content</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">5. Your Data and Databases</h2>

            <h3 className="text-xl font-medium mb-4">5.1 Your Responsibility</h3>
            <p className="text-muted-foreground mb-4">You are solely responsible for:</p>
            <ul className="text-muted-foreground mb-6">
              <li>The databases you connect to</li>
              <li>Having proper authorization to access those databases</li>
              <li>All queries you execute and their consequences</li>
              <li>Backing up your data</li>
              <li>Complying with applicable laws regarding your data</li>
            </ul>

            <h3 className="text-xl font-medium mb-4">5.2 No Access to Your Data</h3>
            <p className="text-muted-foreground mb-4">QueryStudio does not have access to:</p>
            <ul className="text-muted-foreground mb-6">
              <li>Your database credentials (passwords are never stored)</li>
              <li>Your database content</li>
              <li>Your AI conversations</li>
              <li>Your locally stored data</li>
            </ul>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6">
              <h3 className="text-xl font-medium mb-4 text-amber-400">5.3 Data Loss Disclaimer</h3>
              <p className="text-muted-foreground mb-4">
                While we strive to provide reliable software:
              </p>
              <ul className="text-muted-foreground mb-0">
                <li>Always backup your data before making changes</li>
                <li>
                  Review queries before execution, especially DELETE, UPDATE, or DROP statements
                </li>
                <li>
                  We are not responsible for data loss caused by your actions or third-party
                  services
                </li>
              </ul>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">6. Intellectual Property</h2>

            <h3 className="text-xl font-medium mb-4">6.1 Our Rights</h3>
            <p className="text-muted-foreground mb-6">
              QueryStudio, including its code, design, logos, and documentation, is owned by us and
              protected by intellectual property laws. Your license to use QueryStudio does not
              grant you ownership of any intellectual property.
            </p>

            <h3 className="text-xl font-medium mb-4">6.2 Your Rights</h3>
            <p className="text-muted-foreground mb-4">You retain all rights to:</p>
            <ul className="text-muted-foreground mb-6">
              <li>Your databases and their content</li>
              <li>Queries you write</li>
              <li>Any content you create using the Service</li>
            </ul>

            <h3 className="text-xl font-medium mb-4">6.3 License Grant</h3>
            <p className="text-muted-foreground">
              We grant you a limited, non-exclusive, non-transferable license to use QueryStudio in
              accordance with these Terms and your subscription plan.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">7. Open Source Components</h2>
            <p className="text-muted-foreground">
              QueryStudio may include open source software components. These components are subject
              to their respective open source licenses, which take precedence over these Terms for
              those specific components.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">8. Service Availability</h2>

            <h3 className="text-xl font-medium mb-4">8.1 Desktop Application</h3>
            <p className="text-muted-foreground mb-6">
              The desktop application runs locally on your device. We strive to provide reliable
              software but cannot guarantee uninterrupted operation.
            </p>

            <h3 className="text-xl font-medium mb-4">8.2 Web Platform and Updates</h3>
            <ul className="text-muted-foreground mb-6">
              <li>
                The web platform (querystudio.dev) may experience occasional downtime for
                maintenance
              </li>
              <li>
                We may update the desktop application with new features, improvements, or bug fixes
              </li>
              <li>Updates are delivered automatically unless you opt out</li>
            </ul>

            <h3 className="text-xl font-medium mb-4">8.3 No Warranty</h3>
            <p className="text-muted-foreground uppercase text-sm">
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
              INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
              PURPOSE, OR NON-INFRINGEMENT.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">9. Limitation of Liability</h2>

            <h3 className="text-xl font-medium mb-4">9.1 Exclusion of Damages</h3>
            <p className="text-muted-foreground mb-4 uppercase text-sm">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR:
            </p>
            <ul className="text-muted-foreground mb-6 text-sm">
              <li>Any indirect, incidental, special, consequential, or punitive damages</li>
              <li>Loss of profits, data, or business opportunities</li>
              <li>Damages arising from your use of or inability to use the Service</li>
              <li>Damages caused by third-party services, databases, or AI providers</li>
            </ul>

            <h3 className="text-xl font-medium mb-4">9.2 Liability Cap</h3>
            <p className="text-muted-foreground mb-6 uppercase text-sm">
              OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING FROM THESE TERMS OR YOUR USE OF THE SERVICE
              SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM, OR €50
              (WHICHEVER IS GREATER).
            </p>

            <h3 className="text-xl font-medium mb-4">9.3 Consumer Rights</h3>
            <p className="text-muted-foreground">
              Nothing in these Terms affects your statutory rights as a consumer under applicable
              law. Some jurisdictions do not allow the exclusion or limitation of certain damages,
              so some of the above limitations may not apply to you.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">10. Indemnification</h2>
            <p className="text-muted-foreground mb-4">
              You agree to indemnify and hold us harmless from any claims, damages, or expenses
              (including reasonable legal fees) arising from:
            </p>
            <ul className="text-muted-foreground">
              <li>Your violation of these Terms</li>
              <li>Your use of the Service</li>
              <li>Your access to databases</li>
              <li>Your violation of any third-party rights</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">11. Termination</h2>

            <h3 className="text-xl font-medium mb-4">11.1 By You</h3>
            <p className="text-muted-foreground mb-6">
              You may stop using QueryStudio at any time. To delete your account, contact us at{" "}
              <a href="mailto:querystudio@lasse.email" className="text-primary hover:underline">
                querystudio@lasse.email
              </a>
              .
            </p>

            <h3 className="text-xl font-medium mb-4">11.2 By Us</h3>
            <p className="text-muted-foreground mb-4">
              We may suspend or terminate your access if:
            </p>
            <ul className="text-muted-foreground mb-6">
              <li>You violate these Terms</li>
              <li>We are required to do so by law</li>
              <li>We discontinue the Service (with reasonable notice)</li>
            </ul>

            <h3 className="text-xl font-medium mb-4">11.3 Effect of Termination</h3>
            <p className="text-muted-foreground mb-4">Upon termination:</p>
            <ul className="text-muted-foreground">
              <li>Your license to use QueryStudio ends</li>
              <li>You lose access to Pro features</li>
              <li>Your locally stored data remains on your device</li>
              <li>
                Provisions that should survive termination (like limitation of liability) will
                continue to apply
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">12. Changes to These Terms</h2>
            <p className="text-muted-foreground mb-4">
              We may update these Terms from time to time. We will notify you of significant changes
              by:
            </p>
            <ul className="text-muted-foreground mb-6">
              <li>Posting updated Terms on our website</li>
              <li>Updating the "Last Updated" date</li>
              <li>Sending an email for material changes</li>
            </ul>
            <p className="text-muted-foreground">
              Continued use of the Service after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">13. Governing Law and Disputes</h2>

            <h3 className="text-xl font-medium mb-4">13.1 Governing Law</h3>
            <p className="text-muted-foreground mb-6">
              These Terms are governed by the laws of Denmark, without regard to conflict of law
              principles.
            </p>

            <h3 className="text-xl font-medium mb-4">13.2 Dispute Resolution</h3>
            <p className="text-muted-foreground mb-6">
              Before pursuing formal legal action, we encourage you to contact us to resolve
              disputes informally. If a dispute cannot be resolved informally, it shall be submitted
              to the courts of Denmark.
            </p>

            <h3 className="text-xl font-medium mb-4">13.3 EU Consumer Rights</h3>
            <p className="text-muted-foreground">
              If you are a consumer in the European Union, you may also have access to the European
              Commission's Online Dispute Resolution platform at{" "}
              <a
                href="https://ec.europa.eu/consumers/odr"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://ec.europa.eu/consumers/odr
              </a>
              .
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">14. General Provisions</h2>

            <h3 className="text-xl font-medium mb-4">14.1 Entire Agreement</h3>
            <p className="text-muted-foreground mb-6">
              These Terms, together with our{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              , constitute the entire agreement between you and QueryStudio.
            </p>

            <h3 className="text-xl font-medium mb-4">14.2 Severability</h3>
            <p className="text-muted-foreground mb-6">
              If any provision of these Terms is found to be unenforceable, the remaining provisions
              will continue in effect.
            </p>

            <h3 className="text-xl font-medium mb-4">14.3 No Waiver</h3>
            <p className="text-muted-foreground mb-6">
              Our failure to enforce any right or provision does not constitute a waiver of that
              right or provision.
            </p>

            <h3 className="text-xl font-medium mb-4">14.4 Assignment</h3>
            <p className="text-muted-foreground">
              You may not assign or transfer your rights under these Terms. We may assign our rights
              to a successor or affiliate.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-6">15. Contact Us</h2>
            <p className="text-muted-foreground mb-4">
              If you have questions about these Terms, contact us at:
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">Email:</strong>{" "}
              <a href="mailto:querystudio@lasse.email" className="text-primary hover:underline">
                querystudio@lasse.email
              </a>
              <br />
              <strong className="text-foreground">Website:</strong>{" "}
              <a href="https://querystudio.dev" className="text-primary hover:underline">
                https://querystudio.dev
              </a>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t">
        <div className="container mx-auto px-4 py-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-3">
              <img
                src="https://assets-cdn.querystudio.dev/QueryStudioIconNoBG.png"
                alt="QueryStudio"
                className="h-6 w-6"
              />
              <span className="font-medium">QueryStudio</span>
            </div>
            <nav className="flex items-center gap-8">
              <Link to="/download" className="text-sm text-muted-foreground hover:text-foreground">
                Download
              </Link>
              <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
                Pricing
              </Link>
              <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
                Privacy
              </Link>
              <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground">
                Terms
              </Link>
            </nav>
          </div>
          <div className="mt-8 pt-8 border-t flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm text-muted-foreground">
            <span>© {new Date().getFullYear()} QueryStudio. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
