import { Outlet, createRootRoute } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { useUpdateChecker } from "@/hooks/use-update-checker";
import { useAuthDeepLink } from "@/hooks/use-auth-deep-link";
import { useSyncProStatus } from "@/lib/hooks";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: true,
    },
  },
});

export const Route = createRootRoute({
  component: RootComponent,
});

function UpdateChecker() {
  useUpdateChecker();
  return null;
}

function AuthDeepLinkHandler() {
  useAuthDeepLink();
  return null;
}

function ProStatusSync() {
  useSyncProStatus();
  return null;
}

function RootComponent() {
  return (
    <>
      <QueryClientProvider client={queryClient}>
        <Toaster />
        <UpdateChecker />
        <AuthDeepLinkHandler />
        <ProStatusSync />
        <Outlet />
      </QueryClientProvider>
    </>
  );
}
