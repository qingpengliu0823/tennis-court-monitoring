import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardStats, getAlerts } from "./actions/scrape";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, recentAlerts] = await Promise.all([
    getDashboardStats(),
    getAlerts(10),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Courts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.courts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Monitors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.monitors}</div>
          </CardContent>
        </Card>

        <Card className={stats.alertsToday > 0 ? "border-green-500 bg-green-50 dark:border-green-400 dark:bg-green-950/30" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-medium ${stats.alertsToday > 0 ? "text-green-700 dark:text-green-300" : "text-muted-foreground"}`}>
              Alerts Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className={`text-3xl font-bold ${stats.alertsToday > 0 ? "text-green-700 dark:text-green-300" : ""}`}>
                {stats.alertsToday}
              </span>
              {stats.alertsToday > 0 && (
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last Scrape
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {stats.lastScrape
                ? `${stats.lastScrape.status} — ${stats.lastScrape.createdAt.toLocaleTimeString()}`
                : "Never"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No alerts yet.</p>
          ) : (
            <div className="space-y-3">
              {recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start justify-between rounded-md border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {alert.monitor.court.name} — {alert.slotDate}{" "}
                      {alert.slotTime}
                    </p>
                    <p className="text-muted-foreground">
                      Monitor: {alert.monitor.name}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {alert.sentAt.toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
