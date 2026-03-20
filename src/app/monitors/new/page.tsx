import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonitorForm } from "@/components/MonitorForm";
import { getCourts } from "../../actions/courts";

export const dynamic = "force-dynamic";

export default async function NewMonitorPage() {
  const courts = await getCourts();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New Monitor</h1>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Create Monitor</CardTitle>
        </CardHeader>
        <CardContent>
          <MonitorForm
            courts={courts.map((c) => ({
              id: c.id,
              name: c.name,
              serviceTypes: ((c.metadata as Record<string, unknown>)?.serviceTypes as Array<{ name: string; price: string }>) ?? null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
