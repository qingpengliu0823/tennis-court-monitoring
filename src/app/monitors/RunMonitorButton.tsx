"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { runMonitorNow } from "../actions/scrape";

export function RunMonitorButton({ monitorId }: { monitorId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setResult(null);
    try {
      const res = await runMonitorNow(monitorId);
      if (res.error) {
        setResult(`Error: ${res.error}`);
      } else {
        setResult(
          `${res.slotsFound} slots, ${res.newSlots} new, ${res.matchingSlots} matched, ${res.alertsSent} alerts (${res.durationMs}ms)`
        );
      }
    } catch {
      setResult("Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={handleRun} disabled={loading} variant="outline" size="sm">
        {loading ? "Running..." : "Run Now"}
      </Button>
      {result && (
        <span className="text-xs text-muted-foreground">{result}</span>
      )}
    </div>
  );
}
