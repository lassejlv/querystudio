import { createFileRoute, Link, Outlet, useLocation, useRouter } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { acceptTermsAndPrivacyFn } from "@/server/auth";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/dashboard")({
  component: DashboardLayout,
});

const sidebarItems = [
  { label: "Account", href: "/dashboard/account" },
  { label: "Security", href: "/dashboard/security" },
  { label: "Billing", href: "/dashboard/billing" },
];

function TermsAcceptanceBanner() {
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await acceptTermsAndPrivacyFn();
      toast.success("Terms and Privacy Policy accepted");
      router.invalidate();
    } catch {
      toast.error("Failed to accept terms");
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="font-medium text-amber-400">Action Required</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Please review and accept our{" "}
            <Link to="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>{" "}
            to continue using QueryStudio.
          </p>
        </div>
        <Button onClick={handleAccept} disabled={isAccepting} size="sm" className="shrink-0">
          {isAccepting ? "Accepting..." : "I Accept"}
        </Button>
      </div>
    </div>
  );
}

function DashboardLayout() {
  const location = useLocation();
  const { user } = Route.useRouteContext();
  const showTermsBanner = !user.termsAndPrivacyAccepted;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
            <img
              src="https://assets-cdn.querystudio.dev/QueryStudioIconNoBG.png"
              alt="QueryStudio"
              className="h-6 w-6"
            />
            <span className="font-medium">QueryStudio</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link to="/download" className="text-sm text-muted-foreground hover:text-foreground">
              Download
            </Link>
            <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {showTermsBanner && <TermsAcceptanceBanner />}
        <div className="flex gap-12">
          {/* Sidebar */}
          <aside className="w-40 shrink-0">
            <nav className="space-y-1">
              {sidebarItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "block py-1.5 text-sm transition-colors",
                      isActive
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
