import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { Header } from "@/components/header";
import { PageTransition } from "@/components/page-transition";
import { Input } from "@/components/ui/input";
import { ExternalLink, GitBranch } from "lucide-react";
import { createServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { redis } from "bun";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChangelogSection {
  title: string;
  items: string[];
}

interface ChangelogRelease {
  id: number;
  version: string;
  name: string;
  body: string;
  isPrerelease: boolean;
  createdAt: string;
  publishedAt: string;
  htmlUrl: string;
  sections: ChangelogSection[];
}

const GITHUB_REPO = "lassejlv/querystudio-releases";
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases`;

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
  download_count: number;
  content_type: string;
}

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  assets: GitHubAsset[];
  html_url: string;
}

function parseReleaseBody(body: string): ChangelogSection[] {
  const sections: ChangelogSection[] = [];
  const lines = body.split("\n");
  let currentSection: ChangelogSection | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for section headers (##/### Added, ##/### Fixed, etc.)
    const sectionMatch = trimmed.match(/^#{2,3}\s+(.+)$/i);
    if (sectionMatch) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = { title: sectionMatch[1], items: [] };
    } else if (currentSection && trimmed.startsWith("- ")) {
      // List item
      currentSection.items.push(trimmed.substring(2).trim());
    } else if (currentSection && trimmed.startsWith("* ")) {
      // Alternative list item
      currentSection.items.push(trimmed.substring(2).trim());
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

const getChangelog = createServerFn({ method: "GET" }).handler(async () => {
  const cachedData = await redis.get("changelog");

  if (cachedData) {
    return JSON.parse(cachedData) as ChangelogRelease[];
  }

  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "QueryStudio-Web",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch changelog");
    }

    const releases: GitHubRelease[] = await response.json();

    const formattedReleases: ChangelogRelease[] = releases.map((release) => ({
      id: release.id,
      version: release.tag_name,
      name: release.name || release.tag_name,
      body: release.body || "",
      isPrerelease: release.prerelease,
      createdAt: release.created_at,
      publishedAt: release.published_at,
      htmlUrl: release.html_url,
      sections: parseReleaseBody(release.body || ""),
    }));

    await redis.set("changelog", JSON.stringify(formattedReleases), "EX", 3600);
    return formattedReleases;
  } catch (error) {
    console.error("Error fetching changelog:", error);
    return [];
  }
});

export const Route = createFileRoute("/changelog")({
  component: ChangelogPage,
  loader: () => getChangelog(),
});

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function ChangelogPage() {
  const releases = Route.useLoaderData();
  const search = useSearch({ from: "/changelog" });
  const selectedVersion = (search as { version?: string }).version;
  const [versionQuery, setVersionQuery] = useState("");

  const sortedReleases = useMemo(() => {
    return [...releases].sort((a, b) => {
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
  }, [releases]);

  const filteredReleases = useMemo(() => {
    const query = versionQuery.trim().toLowerCase();
    if (!query) return sortedReleases;
    return sortedReleases.filter((release) => {
      return (
        release.version.toLowerCase().includes(query) || release.name.toLowerCase().includes(query)
      );
    });
  }, [sortedReleases, versionQuery]);

  const latestVersion = sortedReleases[0]?.version;

  const selectedRelease = useMemo(() => {
    if (filteredReleases.length === 0) {
      return null;
    }
    if (selectedVersion) {
      return filteredReleases.find((r) => r.version === selectedVersion) || filteredReleases[0];
    }
    return filteredReleases[0];
  }, [filteredReleases, selectedVersion]);

  if (!releases || releases.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <PageTransition>
          <main className="container mx-auto px-4 py-16">
            <div className="max-w-xl mx-auto text-center">
              <h1 className="text-2xl font-semibold mb-2">Changelog</h1>
              <p className="mt-2 text-muted-foreground">No releases available yet.</p>
            </div>
          </main>
        </PageTransition>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <PageTransition>
        <main className="container mx-auto px-4 py-12 max-w-6xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Changelog</h1>
            <p className="text-lg text-muted-foreground">
              Track all the updates, improvements, and bug fixes for QueryStudio.
            </p>
          </div>

          <div className="grid lg:grid-cols-[280px_1fr] gap-8">
            {/* Sidebar */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Releases
                  </h2>
                  <Input
                    type="text"
                    value={versionQuery}
                    onChange={(event) => setVersionQuery(event.target.value)}
                    placeholder="Search versions..."
                    className="mb-3 h-9"
                    aria-label="Search versions"
                  />
                  <nav className="space-y-1">
                    {filteredReleases.map((release) => {
                      const isSelected = selectedRelease?.version === release.version;
                      const isLatest = release.version === latestVersion;

                      return (
                        <Link
                          key={release.id}
                          to="/changelog"
                          search={{ version: release.version }}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                            isSelected
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          <span>{release.version}</span>
                          {isLatest && (
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                              Latest
                            </span>
                          )}
                        </Link>
                      );
                    })}
                    {filteredReleases.length === 0 && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        No matching versions
                      </p>
                    )}
                  </nav>
                </div>

                <div className="pt-4 border-t">
                  <a
                    href={`https://github.com/${GITHUB_REPO}/releases`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <GitBranch className="w-4 h-4" />
                    All Releases
                  </a>
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <div className="space-y-8">
              {selectedRelease && (
                <article className="space-y-6">
                  <div className="border-b pb-6">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-3xl font-bold">QueryStudio {selectedRelease.version}</h2>
                      {latestVersion === selectedRelease.version && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
                          LATEST
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <time dateTime={selectedRelease.publishedAt}>
                        {formatDate(selectedRelease.publishedAt)}
                      </time>
                      <a
                        href={selectedRelease.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        View on GitHub
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Render sections if parsed */}
                  {selectedRelease.sections && selectedRelease.sections.length > 0 ? (
                    <div className="space-y-8">
                      {selectedRelease.sections.map((section, idx) => (
                        <div key={idx}>
                          <h3 className="text-xl font-semibold mb-3">{section.title}</h3>
                          <ul className="space-y-2">
                            {section.items.map((item, itemIdx) => (
                              <li key={itemIdx} className="flex items-start gap-2">
                                <span className="text-muted-foreground mt-1.5">•</span>
                                <div className="text-muted-foreground leading-relaxed [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{ p: ({ children }) => <>{children}</> }}
                                  >
                                    {item}
                                  </ReactMarkdown>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Fallback to raw markdown */
                    <div className="prose prose-neutral dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {selectedRelease.body}
                      </ReactMarkdown>
                    </div>
                  )}
                </article>
              )}
              {!selectedRelease && (
                <div className="rounded-xl border p-6 text-sm text-muted-foreground">
                  No release matches your search.
                </div>
              )}
            </div>
          </div>
        </main>
      </PageTransition>
    </div>
  );
}
