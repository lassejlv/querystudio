import { createFileRoute, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { getPricing } from "@/server/pricing";
import { useMutation } from "@tanstack/react-query";
import { createCheckout, createCustomerPortal, getSubscriptionDetails } from "@/server/billing";
import { toast } from "sonner";
import { useEffect } from "react";

export const Route = createFileRoute("/_authed/dashboard/billing")({
  component: BillingPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      upgrade: search.upgrade as boolean | undefined,
      plan: search.plan as "monthly" | "annually" | "onetime" | undefined,
    };
  },
  loader: async () => {
    const pricing = await getPricing();
    const subscription = await getSubscriptionDetails();

    return { pricing, subscription };
  },
});

function BillingPage() {
  const { user } = Route.useRouteContext();
  const { pricing, subscription } = Route.useLoaderData();
  const search = useSearch({ from: "/_authed/dashboard/billing" });

  const createCheckoutMutation = useMutation({
    mutationFn: async (plan: "monthly" | "annually" | "onetime") => {
      return await createCheckout({ data: { plan } });
    },
    onSuccess: (data) => {
      return window.location.replace(data.url);
    },
    onError: (err) => {
      toast.error("Error", { description: err.message });
    },
  });

  useEffect(() => {
    if (search.upgrade && search.plan && !user.isPro) {
      const plan = search.plan as "monthly" | "annually" | "onetime";
      if (plan === "monthly" || plan === "annually" || plan === "onetime") {
        createCheckoutMutation.mutate(plan);
      }
    }
  }, [search.upgrade, search.plan, user.isPro]);

  const portalMutation = useMutation({
    mutationFn: async () => {
      return await createCustomerPortal();
    },
    onSuccess: (data) => {
      window.open(data.url, "_blank");
    },
    onError: (err) => {
      toast.error("Failed to open customer portal", { description: err.message });
    },
  });

  return (
    <div className="max-w-md">
      <h1 className="text-lg font-medium">Billing</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage your subscription and license.</p>

      <div className="mt-8">
        <div className="flex items-baseline justify-between pb-4 border-b">
          <div>
            <span className="font-medium">{user.isPro ? "Pro" : "Free"}</span>
            <span className="ml-2 text-sm text-muted-foreground">
              {user.isPro && (subscription ? subscription.product.name : "Lifetime access")}
            </span>
          </div>
          {user.isPro && (
            <button
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              Manage
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>

        {user.isPro ? (
          <div className="mt-6">
            <h2 className="text-sm font-medium">What's included</h2>
            {subscription ? (
              <div className="mt-3 text-sm text-muted-foreground">
                <p>Subscription plan with recurring billing</p>
                {subscription.currentPeriodEnd && (
                  <p className="mt-1">
                    Renews: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
              </div>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Unlimited connections</li>
                <li>Commercial use allowed</li>
                <li>Priority support</li>
                <li>Lifetime updates</li>
              </ul>
            )}
          </div>
        ) : (
          <div className="mt-6">
            <h2 className="text-sm font-medium">Upgrade to Pro</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose the plan that works for you.
            </p>

            {/* Monthly Plan */}
            <div className="mt-4 py-4 border-b">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Pro Monthly</span>
                <div>
                  <span className="font-medium">${pricing.tiers.proMonthly.price}</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">3 days free trial</p>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                <li>Unlimited connections</li>
                <li>Commercial use allowed</li>
                <li>Priority support</li>
                <li>Continuous updates</li>
              </ul>
              <Button
                size="sm"
                className="mt-3 w-full"
                onClick={() => createCheckoutMutation.mutate("monthly")}
                disabled={createCheckoutMutation.isPending}
              >
                {createCheckoutMutation.isPending ? "Loading..." : "Get Monthly"}
              </Button>
            </div>

            {/* Annually Plan */}
            <div className="mt-4 py-4 border-b">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Pro Annually</span>
                <div>
                  <span className="font-medium">${pricing.tiers.proAnnually.price}</span>
                  <span className="text-sm text-muted-foreground">/year</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Save 2 months</p>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                <li>Unlimited connections</li>
                <li>Commercial use allowed</li>
                <li>Priority support</li>
                <li>Continuous updates</li>
              </ul>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => createCheckoutMutation.mutate("annually")}
                disabled={createCheckoutMutation.isPending}
              >
                {createCheckoutMutation.isPending ? "Loading..." : "Get Annually"}
              </Button>
            </div>

            {/* One-time Plan */}
            <div className="mt-4 py-4 border-b">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Pro One-time</span>
                <div>
                  <span className="font-medium">${pricing.tiers.pro.earlyBirdPrice}</span>
                  <span className="ml-2 text-sm text-muted-foreground line-through">
                    ${pricing.tiers.pro.price}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Early bird pricing</p>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                <li>Unlimited connections</li>
                <li>Commercial use allowed</li>
                <li>Priority support</li>
                <li>Lifetime updates</li>
              </ul>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full"
                onClick={() => createCheckoutMutation.mutate("onetime")}
                disabled={createCheckoutMutation.isPending}
              >
                {createCheckoutMutation.isPending ? "Loading..." : "Get One-time"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-16 pt-8 border-t">
        <h2 className="text-sm font-medium">Need help?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Contact support at{" "}
          <a href="mailto:querystudio@lasse.email" className="text-foreground hover:underline">
            querystudio@lasse.email
          </a>
        </p>
      </div>
    </div>
  );
}
