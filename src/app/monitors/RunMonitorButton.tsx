"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { runMonitorNow } from "../actions/scrape";

type SlotInfo = { date: string; startTime: string; endTime: string; courtLabel?: string };

type ResultState =
  | { type: "success"; slotsFound: number; newSlots: number; matchingSlots: number; alertsSent: number; durationMs: number; availableSlots: SlotInfo[] }
  | { type: "error"; message: string }
  | null;

export function RunMonitorButton({ monitorId, serviceType }: { monitorId: string; serviceType?: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultState>(null);

  async function handleRun() {
    setLoading(true);
    setResult(null);
    try {
      const res = await runMonitorNow(monitorId);
      if (res.error && !res.slotsFound) {
        setResult({ type: "error", message: res.error });
      } else {
        setResult({
          type: "success",
          slotsFound: res.slotsFound ?? 0,
          newSlots: res.newSlots ?? 0,
          matchingSlots: res.matchingSlots ?? 0,
          alertsSent: res.alertsSent ?? 0,
          durationMs: res.durationMs ?? 0,
          availableSlots: res.availableSlots ?? [],
        });
        router.refresh();
      }
    } catch {
      setResult({ type: "error", message: "Failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleRun} disabled={loading} variant="outline" size="sm">
        {loading ? "Running..." : "Run Now"}
      </Button>

      {result?.type === "success" && result.matchingSlots > 0 && (
        <div className="rounded-md border border-green-500 bg-green-50 px-3 py-2 text-sm text-green-900 dark:bg-green-950/40 dark:text-green-100">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold">
              {result.matchingSlots} available slot{result.matchingSlots > 1 ? "s" : ""}
            </span>
            <span className="text-xs text-green-700 dark:text-green-300">
              ({result.newSlots} new, {result.alertsSent} alert{result.alertsSent !== 1 ? "s" : ""} sent, {result.durationMs}ms)
            </span>
          </div>
          <ul className="mt-1 space-y-0.5 text-xs font-mono">
            {result.availableSlots.map((s, i) => (
              <li key={i}>
                {s.date} {s.startTime}–{s.endTime}
                {s.courtLabel ? ` (${s.courtLabel})` : ""}
                {serviceType ? ` (${serviceType})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result?.type === "success" && result.matchingSlots === 0 && (
        <p className="text-xs text-muted-foreground">
          No available slots match your filters. ({result.slotsFound} scraped, {result.durationMs}ms)
        </p>
      )}

      {result?.type === "error" && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Error: {result.message}
        </p>
      )}
    </div>
  );
}
