"use client";

interface Slot {
  date: string;
  startTime: string;
  endTime: string;
  courtLabel: string | null;
  totalCourts: number | null;
}

export function AvailabilityGrid({ slots }: { slots: Slot[] }) {
  // Group slots by date and time
  const dates = [...new Set(slots.map((s) => s.date))].sort();
  const times = [...new Set(slots.map((s) => s.startTime))].sort();

  // Build lookup: date|time -> slots
  const lookup = new Map<string, Slot[]>();
  for (const slot of slots) {
    const key = `${slot.date}|${slot.startTime}`;
    const existing = lookup.get(key) || [];
    existing.push(slot);
    lookup.set(key, existing);
  }

  if (dates.length === 0) return <p className="text-sm text-muted-foreground">No slots available.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-background px-2 py-1 text-left font-medium">
              Time
            </th>
            {dates.map((d) => (
              <th key={d} className="px-2 py-1 text-center font-medium whitespace-nowrap">
                {formatDate(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map((time) => (
            <tr key={time} className="border-t">
              <td className="sticky left-0 bg-background px-2 py-1 font-mono">
                {time}
              </td>
              {dates.map((date) => {
                const cellSlots = lookup.get(`${date}|${time}`);
                return (
                  <td key={date} className="px-2 py-1 text-center">
                    {cellSlots ? (
                      <span
                        className="inline-block rounded bg-green-100 px-1.5 py-0.5 text-green-800 dark:bg-green-900 dark:text-green-200"
                        title={cellSlots
                          .map(
                            (s) =>
                              `${s.courtLabel || "Court"}: ${s.totalCourts ?? "?"} available`
                          )
                          .join("\n")}
                      >
                        {cellSlots.reduce(
                          (sum, s) => sum + (s.totalCourts ?? 1),
                          0
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
