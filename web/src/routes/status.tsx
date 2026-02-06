import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ExternalLink } from "lucide-react";
import { Header } from "@/components/header";
import { PageTransition } from "@/components/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ServiceStatus = {
  name: string;
  status: string;
};

type IncidentStatus = {
  name: string;
  status: string;
};

type StatusSummary = {
  pageName: string;
  pageUrl: string;
  status: string;
  services: ServiceStatus[];
  incidents: IncidentStatus[];
  maintenances: IncidentStatus[];
  fetchedAt: string;
};

const INSTATUS_URL = "https://querystudio.instatus.com";

function normalizeStatus(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === "UP" || normalized === "OPERATIONAL") return "Operational";
  if (normalized === "HASISSUES" || normalized === "DEGRADED" || normalized === "PARTIALOUTAGE") {
    return "Degraded";
  }
  if (normalized === "UNDERMAINTENANCE" || normalized === "MAINTENANCE") return "Maintenance";
  if (normalized === "DOWN" || normalized === "MAJOROUTAGE") return "Outage";
  return "Unknown";
}

function statusTone(status: string): "default" | "secondary" | "destructive" | "outline" {
  const normalized = normalizeStatus(status);
  if (normalized === "Operational") return "default";
  if (normalized === "Degraded" || normalized === "Maintenance") return "secondary";
  if (normalized === "Outage") return "destructive";
  return "outline";
}

function extractServices(input: unknown): ServiceStatus[] {
  if (!input || typeof input !== "object") return [];

  const node = input as Record<string, unknown>;
  const result: ServiceStatus[] = [];

  const name = node.name;
  const status = node.status;
  if (typeof name === "string" && typeof status === "string") {
    result.push({ name, status });
  }

  const children = node.components;
  if (Array.isArray(children)) {
    for (const child of children) {
      result.push(...extractServices(child));
    }
  }

  return result;
}

function extractIncidents(input: unknown): IncidentStatus[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const node = item as Record<string, unknown>;
      const name = node.name;
      const status = node.status;
      if (typeof name !== "string" || typeof status !== "string") return null;
      return { name, status };
    })
    .filter((item): item is IncidentStatus => item !== null);
}

const getStatusSummary = createServerFn({ method: "GET" }).handler(async () => {
  const fallback: StatusSummary = {
    pageName: "QueryStudio",
    pageUrl: INSTATUS_URL,
    status: "UNKNOWN",
    services: [],
    incidents: [],
    maintenances: [],
    fetchedAt: new Date().toISOString(),
  };

  try {
    const summaryResponse = await fetch(`${INSTATUS_URL}/summary.json`, {
      headers: { Accept: "application/json" },
    });

    if (!summaryResponse.ok) {
      throw new Error(`summary.json request failed with ${summaryResponse.status}`);
    }

    const summaryJson = (await summaryResponse.json()) as Record<string, unknown>;
    const page = (summaryJson.page ?? {}) as Record<string, unknown>;

    const pageName = typeof page.name === "string" ? page.name : fallback.pageName;
    const pageUrl = typeof page.url === "string" ? page.url : fallback.pageUrl;
    const status = typeof page.status === "string" ? page.status : fallback.status;

    const fromSummary = [
      ...extractServices(summaryJson),
      ...extractServices(summaryJson.components),
    ];

    let fromComponentsEndpoint: ServiceStatus[] = [];
    try {
      const componentsResponse = await fetch(`${INSTATUS_URL}/v2/components.json`, {
        headers: { Accept: "application/json" },
      });
      if (componentsResponse.ok) {
        const componentsJson = (await componentsResponse.json()) as unknown;
        if (Array.isArray(componentsJson)) {
          fromComponentsEndpoint = componentsJson.flatMap((item) => extractServices(item));
        } else {
          fromComponentsEndpoint = extractServices(componentsJson);
        }
      }
    } catch (error) {
      console.error("Error fetching Instatus components:", error);
    }

    const dedupedServices = new Map<string, ServiceStatus>();
    for (const service of fromSummary.length > 0 ? fromSummary : fromComponentsEndpoint) {
      if (!dedupedServices.has(service.name)) {
        dedupedServices.set(service.name, service);
      }
    }

    const incidents = extractIncidents(summaryJson.activeIncidents);
    const maintenances = extractIncidents(summaryJson.activeMaintenances);

    return {
      pageName,
      pageUrl,
      status,
      services: Array.from(dedupedServices.values()),
      incidents,
      maintenances,
      fetchedAt: new Date().toISOString(),
    } satisfies StatusSummary;
  } catch (error) {
    console.error("Error fetching Instatus summary:", error);
    return fallback;
  }
});

export const Route = createFileRoute("/status")({
  component: StatusPage,
  loader: () => getStatusSummary(),
});

function StatusPage() {
  const summary = Route.useLoaderData();
  const operationalServices = summary.services.filter(
    (service) => normalizeStatus(service.status) === "Operational",
  ).length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <PageTransition>
        <main className="container mx-auto px-4 py-12 max-w-5xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold">Status</h1>
              <p className="mt-2 text-muted-foreground">
                Live system status powered by Instatus.
              </p>
            </div>
            <Button asChild variant="outline">
              <a href={summary.pageUrl} target="_blank" rel="noreferrer">
                Open Instatus
                <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>{summary.pageName}</span>
                <Badge variant={statusTone(summary.status)}>{normalizeStatus(summary.status)}</Badge>
              </CardTitle>
              <CardDescription>
                Last checked: {new Date(summary.fetchedAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {summary.services.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {operationalServices} of {summary.services.length} services operational.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No component-level issues reported. All services are currently operational.
                </p>
              )}
            </CardContent>
          </Card>

          {summary.services.length > 0 && (
            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">Services</h2>
              <Card>
                <CardContent className="pt-6">
                  <ul className="space-y-3">
                    {summary.services.map((service) => (
                      <li key={service.name} className="flex items-center justify-between gap-3">
                        <span>{service.name}</span>
                        <Badge variant={statusTone(service.status)}>
                          {normalizeStatus(service.status)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>
          )}

          {(summary.incidents.length > 0 || summary.maintenances.length > 0) && (
            <section className="mt-6 grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Active Incidents</CardTitle>
                </CardHeader>
                <CardContent>
                  {summary.incidents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active incidents.</p>
                  ) : (
                    <ul className="space-y-3">
                      {summary.incidents.map((incident) => (
                        <li key={incident.name} className="flex items-center justify-between gap-3">
                          <span>{incident.name}</span>
                          <Badge variant={statusTone(incident.status)}>
                            {normalizeStatus(incident.status)}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Active Maintenance</CardTitle>
                </CardHeader>
                <CardContent>
                  {summary.maintenances.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No planned maintenance.</p>
                  ) : (
                    <ul className="space-y-3">
                      {summary.maintenances.map((maintenance) => (
                        <li
                          key={maintenance.name}
                          className="flex items-center justify-between gap-3"
                        >
                          <span>{maintenance.name}</span>
                          <Badge variant={statusTone(maintenance.status)}>
                            {normalizeStatus(maintenance.status)}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </section>
          )}
        </main>
      </PageTransition>
    </div>
  );
}
