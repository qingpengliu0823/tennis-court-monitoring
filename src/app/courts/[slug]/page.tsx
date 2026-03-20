import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCourt, getCourtSnapshots } from "../../actions/courts";
import { ScrapeButton } from "./ScrapeButton";
import { AvailabilityGrid } from "./AvailabilityGrid";

export const dynamic = "force-dynamic";

export default async function CourtDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const court = await getCourt(slug);
  if (!court) notFound();

  const snapshots = await getCourtSnapshots(court.id);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{court.name}</h1>
          <p className="text-sm text-muted-foreground">{court.location}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={court.enabled ? "default" : "secondary"}>
            {court.bookingSystem}
          </Badge>
          <ScrapeButton courtId={court.id} />
        </div>
      </div>

      {(() => {
        const meta = court.metadata as Record<string, unknown> | null;
        const serviceTypes = meta?.serviceTypes as Array<{ name: string; label?: string; duration?: string; price: string }> | undefined;
        if (!serviceTypes) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle>Service Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {serviceTypes.map((st) => (
                  <div key={st.name} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="font-medium">{st.label || st.name}</span>
                    <span className="text-muted-foreground">{st.price}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <Card>
        <CardHeader>
          <CardTitle>Current Availability</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No availability data yet. Click &quot;Scrape Now&quot; to fetch.
            </p>
          ) : (
            <AvailabilityGrid slots={snapshots} />
          )}
        </CardContent>
      </Card>

      {court.monitors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monitors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {court.monitors.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <div>
                    <span className="font-medium">{m.name}</span>
                    {m.timeFrom && m.timeTo && (
                      <span className="ml-2 text-muted-foreground">
                        {m.timeFrom}–{m.timeTo}
                      </span>
                    )}
                  </div>
                  <Badge variant={m.enabled ? "default" : "secondary"}>
                    {m.enabled ? "Active" : "Paused"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-sm text-muted-foreground">
        <a
          href={((court.metadata as Record<string, unknown>)?.deepLink as string) || court.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Open booking page
        </a>
      </div>
    </div>
  );
}
