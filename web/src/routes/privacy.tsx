import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/header";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      {
        title: "Privacy Policy - QueryStudio",
      },
      {
        name: "description",
        content:
          "QueryStudio Privacy Policy - Learn how we collect, use, and protect your information.",
      },
    ],
  }),
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 pt-20 pb-16 max-w-4xl">
        <h1 className="text-4xl font-semibold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-12">Last Updated: February 2, 2026</p>

        <div className="prose prose-invert max-w-none">
          <p className="text-lg text-muted-foreground mb-8">
            QueryStudio ("we," "our," or "us") is developed and operated from Denmark. This Privacy
            Policy explains how we collect, use, and protect your information when you use our
            desktop application and web platform at querystudio.dev.
          </p>

          <div className="bg-muted/30 border rounded-xl p-6 mb-12">
            <h2 className="text-xl font-semibold mb-4 mt-0">Summary</h2>
            <ul className="space-y-2 text-muted-foreground mb-0">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>
                  <strong className="text-foreground">Desktop app data stays local</strong> - Your
                  database connections, queries, and AI API keys are stored on your device, not our
                  servers
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>
                  <strong className="text-foreground">We collect minimal account data</strong> -
                  Only what's needed for authentication and billing
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>
                  <strong className="text-foreground">We don't sell your data</strong> - Your
                  information is never sold to third parties
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>
                  <strong className="text-foreground">AI requests go directly to providers</strong>{" "}
                  - We don't proxy or store your AI conversations
                </span>
              </li>
            </ul>
          </div>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">1. Information We Collect</h2>

            <h3 className="text-xl font-medium mb-4">1.1 Account Information (Web Platform)</h3>
            <p className="text-muted-foreground mb-4">
              When you create an account on querystudio.dev, we collect:
            </p>
            <ul className="text-muted-foreground mb-6">
              <li>
                <strong className="text-foreground">Name</strong> and{" "}
                <strong className="text-foreground">email address</strong>
              </li>
              <li>
                <strong className="text-foreground">Password</strong> (stored securely using one-way
                hashing)
              </li>
              <li>
                <strong className="text-foreground">Email verification status</strong>
              </li>
              <li>
                <strong className="text-foreground">Account creation and update timestamps</strong>
              </li>
            </ul>
            <p className="text-muted-foreground mb-6">
              If you sign up using GitHub OAuth, we also receive your GitHub account identifier and
              OAuth tokens (stored securely for authentication purposes).
            </p>

            <h3 className="text-xl font-medium mb-4">1.2 Session Information</h3>
            <p className="text-muted-foreground mb-6">
              For security and session management, we collect IP address, user agent (browser and
              device information), and session tokens. This information helps us detect unauthorized
              access and protect your account.
            </p>

            <h3 className="text-xl font-medium mb-4">1.3 Payment Information</h3>
            <p className="text-muted-foreground mb-6">
              When you purchase a subscription or license, payment is processed by our payment
              provider, Polar. We store your Polar customer ID, subscription status, and license
              key.{" "}
              <strong className="text-foreground">We do not store your credit card details.</strong>
            </p>

            <h3 className="text-xl font-medium mb-4">1.4 Desktop Application (Local Data Only)</h3>
            <p className="text-muted-foreground mb-4">
              The QueryStudio desktop application stores the following data{" "}
              <strong className="text-foreground">locally on your device</strong>. This data is{" "}
              <strong className="text-foreground">never transmitted to our servers</strong>:
            </p>
            <ul className="text-muted-foreground mb-6">
              <li>
                Database connection configurations (host, port, username, database name) - Note:
                Passwords are never stored
              </li>
              <li>UI preferences (theme, sidebar width, active tabs)</li>
              <li>Query history (last 100 queries per connection)</li>
              <li>AI chat history</li>
              <li>AI API keys (OpenAI, Anthropic, Google) that you provide</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">2. How We Use Your Information</h2>
            <p className="text-muted-foreground mb-4">We use your information to:</p>
            <ul className="text-muted-foreground">
              <li>
                <strong className="text-foreground">Provide and maintain our services</strong> -
                Account management, authentication, and feature access
              </li>
              <li>
                <strong className="text-foreground">Process payments</strong> - Handle subscriptions
                and one-time purchases
              </li>
              <li>
                <strong className="text-foreground">Communicate with you</strong> - Send email
                verification, account updates, and waitlist notifications
              </li>
              <li>
                <strong className="text-foreground">Improve our services</strong> - Analyze usage
                patterns on our web platform (not the desktop app)
              </li>
              <li>
                <strong className="text-foreground">Ensure security</strong> - Protect against
                unauthorized access and abuse
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">3. Third-Party Services</h2>
            <p className="text-muted-foreground mb-4">We use the following third-party services:</p>

            <div className="space-y-4">
              <div className="bg-muted/20 border rounded-lg p-4">
                <h4 className="font-medium mb-1">Polar (polar.sh)</h4>
                <p className="text-sm text-muted-foreground mb-0">
                  Payment processing - We share your email, name, and customer ID
                </p>
              </div>
              <div className="bg-muted/20 border rounded-lg p-4">
                <h4 className="font-medium mb-1">Cloudflare Turnstile</h4>
                <p className="text-sm text-muted-foreground mb-0">
                  Bot protection on login and signup forms
                </p>
              </div>
              <div className="bg-muted/20 border rounded-lg p-4">
                <h4 className="font-medium mb-1">UseSend</h4>
                <p className="text-sm text-muted-foreground mb-0">
                  Transactional email delivery (verification, notifications)
                </p>
              </div>
              <div className="bg-muted/20 border rounded-lg p-4">
                <h4 className="font-medium mb-1">GitHub (OAuth)</h4>
                <p className="text-sm text-muted-foreground mb-0">Optional social login</p>
              </div>
              <div className="bg-muted/20 border rounded-lg p-4">
                <h4 className="font-medium mb-1">AI Providers (Bring Your Own Key)</h4>
                <p className="text-sm text-muted-foreground mb-0">
                  Your API keys are stored locally. Requests go directly from your device to the AI
                  provider. QueryStudio does not proxy, store, or have access to your AI
                  conversations.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">4. Data Storage and Security</h2>

            <h3 className="text-xl font-medium mb-4">4.1 Cloud Storage (Web Platform)</h3>
            <p className="text-muted-foreground mb-6">
              Account data is stored in secure PostgreSQL databases with encrypted connections
              (HTTPS/TLS), secure password hashing, rate limiting, and automatic session expiration.
            </p>

            <h3 className="text-xl font-medium mb-4">4.2 Local Storage (Desktop App)</h3>
            <p className="text-muted-foreground mb-6">
              Desktop app data is stored locally using SQLite database and browser localStorage.{" "}
              <strong className="text-foreground">This data never leaves your device</strong> unless
              you explicitly choose to use features that require network access.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">5. Your Rights</h2>
            <p className="text-muted-foreground mb-4">
              Under applicable data protection laws (including GDPR), you have the right to:
            </p>
            <ul className="text-muted-foreground mb-6">
              <li>
                <strong className="text-foreground">Access</strong> your personal data
              </li>
              <li>
                <strong className="text-foreground">Correct</strong> inaccurate personal data
              </li>
              <li>
                <strong className="text-foreground">Delete</strong> your personal data
              </li>
              <li>
                <strong className="text-foreground">Export</strong> your personal data in a portable
                format
              </li>
              <li>
                <strong className="text-foreground">Withdraw consent</strong> for optional data
                processing
              </li>
              <li>
                <strong className="text-foreground">Object</strong> to certain types of data
                processing
              </li>
            </ul>
            <p className="text-muted-foreground">
              To exercise these rights, contact us at{" "}
              <a href="mailto:querystudio@lasse.email" className="text-primary hover:underline">
                querystudio@lasse.email
              </a>
              .
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">6. Data We Do NOT Collect</h2>
            <p className="text-muted-foreground mb-4">
              We want to be clear about what we don't collect:
            </p>
            <ul className="text-muted-foreground">
              <li>
                <strong className="text-foreground">Database passwords</strong> - Never stored
                anywhere
              </li>
              <li>
                <strong className="text-foreground">Your database content</strong> - Stays between
                you and your database servers
              </li>
              <li>
                <strong className="text-foreground">AI chat content</strong> - Stays between you and
                the AI provider
              </li>
              <li>
                <strong className="text-foreground">Desktop app usage analytics</strong> - No
                telemetry in the desktop application
              </li>
              <li>
                <strong className="text-foreground">Your AI API keys</strong> - Stored locally on
                your device only
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">7. Children's Privacy</h2>
            <p className="text-muted-foreground">
              QueryStudio is not intended for children under 16 years of age. We do not knowingly
              collect personal information from children under 16. If you believe we have collected
              information from a child under 16, please contact us immediately.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">8. International Data Transfers</h2>
            <p className="text-muted-foreground">
              QueryStudio is operated from Denmark. If you access our services from outside the
              European Union, your information may be transferred to and processed in countries with
              different data protection laws. We ensure appropriate safeguards are in place for such
              transfers.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">9. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify you of significant
              changes by posting the new policy on our website, updating the "Last Updated" date,
              and sending an email notification for material changes.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">10. Contact Us</h2>
            <p className="text-muted-foreground mb-4">
              If you have questions about this Privacy Policy or your personal data, contact us at:
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

          <section>
            <h2 className="text-2xl font-semibold mb-6">11. Legal Basis for Processing (GDPR)</h2>
            <p className="text-muted-foreground mb-4">
              For users in the European Economic Area, we process personal data based on:
            </p>
            <ul className="text-muted-foreground mb-0">
              <li>
                <strong className="text-foreground">Contract performance</strong> - To provide our
                services and fulfill our obligations to you
              </li>
              <li>
                <strong className="text-foreground">Legitimate interests</strong> - For security,
                fraud prevention, and service improvement
              </li>
              <li>
                <strong className="text-foreground">Consent</strong> - For optional features like
                marketing communications
              </li>
              <li>
                <strong className="text-foreground">Legal obligations</strong> - To comply with
                applicable laws
              </li>
            </ul>
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
