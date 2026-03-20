import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAlerts } from "../actions/scrape";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const alerts = await getAlerts(100);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Alerts</h1>

      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No alerts yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Court</TableHead>
              <TableHead>Slot</TableHead>
              <TableHead>Monitor</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.map((alert) => (
              <TableRow key={alert.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {alert.sentAt.toLocaleString()}
                </TableCell>
                <TableCell className="text-sm">
                  {alert.monitor.court.name}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {alert.slotDate} {alert.slotTime}
                  {alert.courtLabel && (
                    <span className="ml-1 text-muted-foreground">
                      ({alert.courtLabel})
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm">{alert.monitor.name}</TableCell>
                <TableCell>
                  <Badge variant={alert.delivered ? "default" : "destructive"}>
                    {alert.delivered ? "Sent" : "Failed"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
