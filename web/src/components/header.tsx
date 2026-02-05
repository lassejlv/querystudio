import { Link, useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Settings } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";

export function Header() {
  const location = useLocation();
  const currentPath = location.pathname;

  const { data: session, isLoading } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const result = await authClient.getSession();
      return result.data;
    },
  });

  const user = session?.user;

  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.href = "/";
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
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

        <nav className="flex items-center gap-4">
          <Link
            to="/"
            className={`text-sm ${currentPath === "/" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Home
          </Link>
          <Link
            to="/download"
            className={`text-sm ${currentPath === "/download" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Download
          </Link>
          <Link
            to="/changelog"
            className={`text-sm ${currentPath === "/changelog" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Changelog
          </Link>
          <Link
            to="/pricing"
            className={`text-sm ${currentPath === "/pricing" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Pricing
          </Link>

          {isLoading ? (
            <div className="w-7 h-7 rounded-full bg-muted" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium hover:bg-muted/80">
                  {getInitials(user.name)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  {user.name && <p className="text-sm font-medium">{user.name}</p>}
                  {user.email && (
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">
                    <User className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard/account">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-red-600 focus:text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Login</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/signup">Sign up</Link>
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
