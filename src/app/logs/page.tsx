import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getScrapeLogs } from "../actions/scrape";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const logs = await getScrapeLogs(100);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Scrape Logs</h1>

      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No scrape logs yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Court</TableHead>
              <TableHead>Adapter</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Slots</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {log.createdAt.toLocaleString()}
                </TableCell>
                <TableCell className="text-sm">
                  {log.court?.name || "—"}
                </TableCell>
                <TableCell className="text-sm">{log.adapter}</TableCell>
                <TableCell>
                  <Badge
                    variant={log.status === "success" ? "default" : "destructive"}
                  >
                    {log.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{log.slotsFound}</TableCell>
                <TableCell className="text-sm">{log.durationMs}ms</TableCell>
                <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                  {log.error || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
