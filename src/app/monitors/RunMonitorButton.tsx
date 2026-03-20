"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { runMonitorNow } from "../actions/scrape";

type ResultState =
  | { type: "success"; slotsFound: number; newSlots: number; matchingSlots: number; alertsSent: number; durationMs: number }
  | { type: "error"; message: string }
  | null;

export function RunMonitorButton({ monitorId }: { monitorId: string }) {
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
          <span className="font-semibold">
            {result.matchingSlots} matching slot{result.matchingSlots > 1 ? "s" : ""} found!
          </span>
          <span className="ml-2 text-xs text-green-700 dark:text-green-300">
            ({result.slotsFound} total, {result.newSlots} new, {result.alertsSent} alert{result.alertsSent !== 1 ? "s" : ""} sent)
          </span>
        </div>
      )}

      {result?.type === "success" && result.matchingSlots === 0 && (
        <p className="text-xs text-muted-foreground">
          No matching slots. ({result.slotsFound} total, {result.newSlots} new, {result.durationMs}ms)
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
