"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { scrapeNow } from "../../actions/scrape";

export function ScrapeButton({ courtId }: { courtId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleScrape() {
    setLoading(true);
    setResult(null);
    try {
      const res = await scrapeNow(courtId);
      if (res.error) {
        setResult(`Error: ${res.error}`);
      } else {
        setResult(
          `Found ${res.slotsFound} slots (${res.newSlots} new) in ${res.durationMs}ms`
        );
      }
    } catch {
      setResult("Scrape failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={handleScrape} disabled={loading} size="sm">
        {loading ? "Scraping..." : "Scrape Now"}
      </Button>
      {result && (
        <span className="text-xs text-muted-foreground">{result}</span>
      )}
    </div>
  );
}
