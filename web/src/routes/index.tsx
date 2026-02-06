import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/header";
import { PageTransition } from "@/components/page-transition";
import { OptimizedVideo } from "@/components/optimized-video";
import { Download, ArrowRight, Database, Code2, Sparkles } from "lucide-react";
import { getPricing } from "@/server/pricing";

export const Route = createFileRoute("/")({
  component: LandingPage,
  loader: () => getPricing(),
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <PageTransition>
        <main>
          <section className="relative">
            <div className="absolute inset-0 -z-10">
              <div className="absolute left-1/2 top-0 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(14,116,144,0.18),transparent_55%)] blur-3xl" />
            </div>

            <div className="container mx-auto px-4 pt-24 md:pt-32 pb-12">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground bg-background/80">
                  Now available for Mac, Windows, and Linux
                </div>

                <h1 className="mt-6 text-5xl md:text-7xl font-semibold tracking-tight text-foreground leading-[1.05]">
                  The database studio
                  <br />
                  <span className="text-foreground/80">you deserve</span>
                </h1>

                <p className="mt-6 text-xl text-muted-foreground max-w-2xl leading-relaxed">
                  Write SQL, explore schemas, and query with natural language. Native desktop app
                  for Mac, Windows, and Linux.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Button asChild size="lg" className="h-12 px-7 text-base rounded-full shadow-sm">
                    <Link to="/download">
                      <Download className="h-5 w-5 mr-2" />
                      Download Free
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    asChild
                    className="h-12 px-6 text-base rounded-full"
                  >
                    <a
                      href="https://github.com/querystudio/querystudio"
                      target="_blank"
                      rel="noreferrer"
                    >
                      View on GitHub
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Open Source
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Local-first
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    No cloud
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="container mx-auto px-4 pb-20">
            <div className="rounded-[28px] border bg-background shadow-[0_10px_40px_rgba(0,0,0,0.08)] overflow-hidden">
              <OptimizedVideo
                src="https://assets-cdn.querystudio.dev/QueryStudioExampleNew.mp4"
                containerClassName="aspect-video"
              />
            </div>
          </section>

          <section className="border-t bg-muted/10">
            <div className="container mx-auto px-4 py-20">
              <div className="max-w-2xl">
                <h2 className="text-3xl md:text-4xl font-semibold">Everything you need</h2>
                <p className="mt-4 text-muted-foreground">
                  A complete database studio with powerful features for developers and teams.
                </p>
              </div>

              <div className="mt-12 grid gap-12">
                <div className="grid items-center gap-8 md:grid-cols-2">
                  <div>
                    <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Database className="h-4 w-4" />
                      Multiple Connections
                    </div>
                    <h3 className="mt-3 text-2xl font-semibold text-foreground">
                      All your databases, one studio
                    </h3>
                    <p className="mt-3 text-muted-foreground">
                      PostgreSQL & MySQL support with SQLite, MongoDB and Redis coming soon. All
                      local-first and secure.
                    </p>
                  </div>
                  <div className="rounded-[24px] border bg-background overflow-hidden">
                    <OptimizedVideo
                      src="https://assets-cdn.querystudio.dev/QueryStudioExampleNew.mp4"
                      containerClassName="aspect-video"
                    />
                  </div>
                </div>

                <div className="grid items-center gap-8 md:grid-cols-2">
                  <div className="order-2 md:order-1 rounded-[24px] border bg-background overflow-hidden">
                    <OptimizedVideo
                      src="https://assets-cdn.querystudio.dev/QueryStudioCustomTheme.mp4"
                      containerClassName="aspect-video"
                    />
                  </div>
                  <div className="order-1 md:order-2">
                    <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Code2 className="h-4 w-4" />
                      Smart Query Editor
                    </div>
                    <h3 className="mt-3 text-2xl font-semibold text-foreground">
                      Tailor the workspace to your flow
                    </h3>
                    <p className="mt-3 text-muted-foreground">
                      A focused editor with syntax highlighting, auto-complete, and keyboard
                      shortcuts that stay out of the way.
                    </p>
                  </div>
                </div>

                <div className="grid items-center gap-8 md:grid-cols-2">
                  <div>
                    <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Sparkles className="h-4 w-4" />
                      QueryBuddy AI
                    </div>
                    <h3 className="mt-3 text-2xl font-semibold text-foreground">
                      Ask in plain English, get SQL
                    </h3>
                    <p className="mt-3 text-muted-foreground">
                      A native AI agent built into your database. Describe what you need and it
                      writes SQL based on your schema.
                    </p>
                  </div>
                  <div className="rounded-[24px] border bg-background overflow-hidden">
                    <OptimizedVideo
                      src="https://assets-cdn.querystudio.dev/AIAgent.mp4"
                      containerClassName="aspect-video"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </PageTransition>

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
              <Link to="/status" className="text-sm text-muted-foreground hover:text-foreground">
                Status
              </Link>
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
                Login
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
