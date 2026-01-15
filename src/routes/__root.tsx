import { Outlet, createRootRoute } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { useUpdateChecker } from "@/hooks/use-update-checker";
import { useBetterAuthTauri } from "@daveyplate/better-auth-tauri/react";
import { toast } from "sonner";

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

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <UpdateChecker />
      <Outlet />
    </QueryClientProvider>
  );
}
