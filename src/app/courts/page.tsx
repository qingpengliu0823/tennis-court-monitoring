import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCourts } from "../actions/courts";

export const dynamic = "force-dynamic";

export default async function CourtsPage() {
  const courts = await getCourts();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Courts</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courts.map((court) => (
          <Link key={court.id} href={`/courts/${court.slug}`}>
            <Card className="transition-colors hover:border-foreground/20">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{court.name}</CardTitle>
                  <Badge variant={court.enabled ? "default" : "secondary"}>
                    {court.enabled ? "Active" : "Disabled"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{court.location}</p>
                <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                  <span>{court.bookingSystem}</span>
                  <span>{court._count.monitors} monitors</span>
                  <span>{court._count.snapshots} snapshots</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
