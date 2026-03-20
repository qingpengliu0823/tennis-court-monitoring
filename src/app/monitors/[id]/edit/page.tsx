import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonitorForm } from "@/components/MonitorForm";
import { getMonitor } from "../../../actions/monitors";
import { getCourts } from "../../../actions/courts";

export const dynamic = "force-dynamic";

export default async function EditMonitorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [monitor, courts] = await Promise.all([getMonitor(id), getCourts()]);

  if (!monitor) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit Monitor</h1>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{monitor.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <MonitorForm
            courts={courts.map((c) => ({
              id: c.id,
              name: c.name,
              serviceTypes: ((c.metadata as Record<string, unknown>)?.serviceTypes as Array<{ name: string; label?: string; price: string }>) ?? null,
            }))}
            defaults={{
              id: monitor.id,
              name: monitor.name,
              courtId: monitor.courtId,
              serviceType: monitor.serviceType,
              daysOfWeek: monitor.daysOfWeek,
              timeFrom: monitor.timeFrom,
              timeTo: monitor.timeTo,
              dateFrom: monitor.dateFrom,
              dateTo: monitor.dateTo,
              checkIntervalMin: monitor.checkIntervalMin,
              cooldownMin: monitor.cooldownMin,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
