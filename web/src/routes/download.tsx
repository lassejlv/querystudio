import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/header";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, Apple, Monitor, Terminal } from "lucide-react";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { redis } from "bun";

const donateUrl = "https://buy.polar.sh/polar_cl_GjR7lflPCEnKKPTB2QE5eNOfWOLqlRNYJAvsF2Tf9t6";

interface FormattedAsset {
  name: string;
  downloadUrl: string;
  size: number;
  downloadCount: number;
  contentType: string;
  platform: "macos" | "windows" | "linux" | "unknown";
  arch: "x64" | "arm64" | "universal" | "unknown";
}

interface FormattedRelease {
  id: number;
  version: string;
  name: string;
  body: string;
  isPrerelease: boolean;
  createdAt: string;
  publishedAt: string;
  assets: FormattedAsset[];
  htmlUrl: string;
}

const getLatestRelease = createServerFn({ method: "GET" }).handler(async () => {
  const GITHUB_REPO = "lassejlv/querystudio-releases";
  const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

  const cachedData = await redis.get("latest-release");

  if (cachedData) {
    return JSON.parse(cachedData) as FormattedRelease;
  }

  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "QueryStudio-Web",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error("Failed to fetch latest release");
    }

    const release = await response.json();

    const detectPlatform = (filename: string): FormattedAsset["platform"] => {
      const lower = filename.toLowerCase();
      if (lower.includes(".dmg") || lower.includes("macos") || lower.includes("darwin")) {
        return "macos";
      }
      if (
        lower.includes(".exe") ||
        lower.includes(".msi") ||
        lower.includes("windows") ||
        lower.includes("win32") ||
        lower.includes("win64")
      ) {
        return "windows";
      }
      if (
        lower.includes(".deb") ||
        lower.includes(".rpm") ||
        lower.includes(".appimage") ||
        lower.includes("linux")
      ) {
        return "linux";
      }
      return "unknown";
    };

    const detectArch = (filename: string): FormattedAsset["arch"] => {
      const lower = filename.toLowerCase();
      if (lower.includes("universal")) {
        return "universal";
      }
      if (lower.includes("arm64") || lower.includes("aarch64")) {
        return "arm64";
      }
      if (lower.includes("x64") || lower.includes("x86_64") || lower.includes("amd64")) {
        return "x64";
      }
      return "unknown";
    };

    const data = {
      id: release.id,
      version: release.tag_name,
      name: release.name || release.tag_name,
      body: release.body || "",
      isPrerelease: release.prerelease,
      createdAt: release.created_at,
      publishedAt: release.published_at,
      htmlUrl: release.html_url,
      assets: release.assets.map(
        (asset: {
          name: string;
          browser_download_url: string;
          size: number;
          download_count: number;
          content_type: string;
        }) => ({
          name: asset.name,
          downloadUrl: asset.browser_download_url,
          size: asset.size,
          downloadCount: asset.download_count,
          contentType: asset.content_type,
          platform: detectPlatform(asset.name),
          arch: detectArch(asset.name),
        }),
      ),
    } as FormattedRelease;

    await redis.set("latest-release", JSON.stringify(data), "EX", 3600);

    return data;
  } catch (error) {
    console.error("Error fetching latest release:", error);
    return null;
  }
});

export const Route = createFileRoute("/download")({
  component: DownloadPage,
  loader: () => getLatestRelease(),
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function isSignatureFile(filename: string): boolean {
  return filename.endsWith(".sig") || filename.endsWith(".asc");
}

function getArchLabel(arch: FormattedAsset["arch"]) {
  switch (arch) {
    case "arm64":
      return "Apple Silicon";
    case "x64":
      return "Intel";
    case "universal":
      return "Universal";
    default:
      return "";
  }
}

function getAssetLabel(asset: FormattedAsset): string {
  const lower = asset.name.toLowerCase();

  if (asset.platform === "windows") {
    if (lower.endsWith(".exe")) return "Installer (.exe)";
    if (lower.endsWith(".msi")) return "MSI package";
  }

  if (asset.platform === "linux") {
    if (lower.endsWith(".deb")) return "Debian/Ubuntu (.deb)";
    if (lower.endsWith(".rpm")) return "Fedora/RHEL (.rpm)";
    if (lower.endsWith(".appimage")) return "AppImage";
  }

  const archLabel = getArchLabel(asset.arch);
  return archLabel || asset.name;
}

function DownloadPage() {
  const release = Route.useLoaderData();
  const [userPlatform, setUserPlatform] = useState<"macos" | "windows" | "linux" | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("mac")) setUserPlatform("macos");
    else if (ua.includes("win")) setUserPlatform("windows");
    else if (ua.includes("linux") || ua.includes("x11")) setUserPlatform("linux");
  }, []);

  if (!release) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <PageTransition>
          <main className="container mx-auto px-4 py-16">
            <div className="max-w-xl mx-auto text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
                <Download className="w-8 h-8 text-muted-foreground" />
              </div>
              <h1 className="text-2xl font-semibold mb-2">Download</h1>
              <p className="mt-2 text-muted-foreground">No releases available yet.</p>
              <div className="mt-6">
                <Button variant="outline" asChild>
                  <Link to="/" className="inline-flex items-center gap-2">
                    Back to home
                  </Link>
                </Button>
              </div>
            </div>
          </main>
        </PageTransition>
      </div>
    );
  }

  const macosAssets = release.assets.filter(
    (a) => a.platform === "macos" && !isSignatureFile(a.name),
  );
  const windowsAssets = release.assets.filter(
    (a) => a.platform === "windows" && !isSignatureFile(a.name),
  );
  const linuxAssets = release.assets.filter(
    (a) => a.platform === "linux" && !isSignatureFile(a.name),
  );
  const platformAssets = {
    macos: macosAssets,
    windows: windowsAssets,
    linux: linuxAssets,
  } as const;

  const platformPreferredAsset = userPlatform
    ? platformAssets[userPlatform].find((a) => a.arch === "universal") ||
      platformAssets[userPlatform][0]
    : undefined;
  const featuredAsset =
    platformPreferredAsset || macosAssets[0] || windowsAssets[0] || linuxAssets[0];

  const cards = [
    { key: "macos" as const, title: "macOS", subtitle: "10.15+", Icon: Apple, assets: macosAssets },
    {
      key: "windows" as const,
      title: "Windows",
      subtitle: "10+",
      Icon: Monitor,
      assets: windowsAssets,
    },
    {
      key: "linux" as const,
      title: "Linux",
      subtitle: "Various distros",
      Icon: Terminal,
      assets: linuxAssets,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <PageTransition>
        <main className="container mx-auto px-4 py-16 max-w-5xl">
          <div className="mb-12 rounded-2xl border bg-card/50 p-8 md:p-10">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground mb-3">
              Download
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold mb-3">
              QueryStudio {release.version}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Published{" "}
              <time dateTime={release.publishedAt}>
                {new Date(release.publishedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {featuredAsset && (
                <Button asChild size="lg">
                  <a
                    href={featuredAsset.downloadUrl}
                    download
                    className="inline-flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    {userPlatform
                      ? `Download for ${userPlatform === "macos" ? "macOS" : userPlatform === "windows" ? "Windows" : "Linux"}`
                      : "Download latest"}
                  </a>
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link to="/changelog" className="inline-flex items-center gap-2">
                  View changelog
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5 mb-12">
            {cards.map(({ key, title, subtitle, Icon, assets }) => {
              const isUserPlatform = userPlatform === key;
              return (
                <section
                  key={key}
                  className={`rounded-2xl border bg-card p-5 ${isUserPlatform ? "border-primary/40 bg-primary/[0.04]" : ""}`}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg border bg-background p-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <h2 className="font-medium">{title}</h2>
                        <p className="text-xs text-muted-foreground">{subtitle}</p>
                      </div>
                    </div>
                    {isUserPlatform && (
                      <span className="rounded-full bg-primary px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                        Recommended
                      </span>
                    )}
                  </div>

                  {assets.length > 0 ? (
                    <div className="space-y-1">
                      {assets.map((asset) => (
                        <a
                          key={asset.name}
                          href={asset.downloadUrl}
                          download
                          className="group flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted"
                        >
                          <span className="truncate pr-2 text-sm font-medium">
                            {getAssetLabel(asset)}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground group-hover:text-foreground">
                            {formatBytes(asset.size)}
                          </span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="py-3 text-sm text-muted-foreground">No build available yet.</p>
                  )}
                </section>
              );
            })}
          </div>

          <div className="rounded-2xl border bg-muted/30 p-6 md:p-8">
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Apple className="w-5 h-5" />
                  macOS Note
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The app isn't signed yet. Right-click and select "Open" on first launch to bypass
                  Gatekeeper.
                </p>
                <a
                  href={donateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm mt-3 hover:underline text-primary"
                >
                  Support signing <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Release Notes</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  View the full changelog and release notes on GitHub.
                </p>
                <a
                  href={release.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm hover:underline text-primary"
                >
                  View on GitHub <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </main>
      </PageTransition>
    </div>
  );
}
