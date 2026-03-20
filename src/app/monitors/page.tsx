import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getMonitors } from "../actions/monitors";
import { MonitorToggle } from "./MonitorToggle";
import { RunMonitorButton } from "./RunMonitorButton";
import { DeleteMonitorButton } from "./DeleteMonitorButton";

export const dynamic = "force-dynamic";

export default async function MonitorsPage() {
  const monitors = await getMonitors();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Monitors</h1>
        <Link href="/monitors/new">
          <Button size="sm">New Monitor</Button>
        </Link>
      </div>

      {monitors.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No monitors yet. Create one to start tracking availability.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {monitors.map((monitor) => (
            <Card key={monitor.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{monitor.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {monitor.court.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">
                      {monitor._count.alerts} alerts
                    </Badge>
                    <Link href={`/monitors/${monitor.id}/edit`}>
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </Link>
                    <DeleteMonitorButton monitorId={monitor.id} />
                    <MonitorToggle
                      monitorId={monitor.id}
                      enabled={monitor.enabled}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  {monitor.serviceType && (() => {
                    const types = (monitor.court.metadata as Record<string, unknown>)?.serviceTypes as Array<{ name: string; label?: string }> | undefined;
                    const label = types?.find((t) => t.name === monitor.serviceType)?.label || monitor.serviceType;
                    return <span>Type: {label}</span>;
                  })()}
                  {monitor.timeFrom && monitor.timeTo && (
                    <span>
                      Time: {monitor.timeFrom}–{monitor.timeTo}
                    </span>
                  )}
                  {monitor.daysOfWeek.length > 0 && (
                    <span>
                      Days:{" "}
                      {monitor.daysOfWeek
                        .map(
                          (d) =>
                            ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]
                        )
                        .join(", ")}
                    </span>
                  )}
                  <span>Every {monitor.checkIntervalMin}min</span>
                  {monitor.lastCheckedAt && (
                    <span>
                      Last checked:{" "}
                      {monitor.lastCheckedAt.toLocaleTimeString()}
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <RunMonitorButton monitorId={monitor.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
