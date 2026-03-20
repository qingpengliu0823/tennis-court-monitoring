"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CourtList } from "./CourtList";

const CourtMap = dynamic(() => import("./CourtMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-muted/30 text-muted-foreground text-sm">
      Loading map...
    </div>
  ),
});

interface Court {
  id: string;
  name: string;
  slug: string;
  bookingSystem: string;
  bookingUrl: string;
  location: string | null;
  metadata: unknown;
  enabled: boolean;
  _count: { snapshots: number; monitors: number };
}

export function CourtsExplorer({ courts }: { courts: Court[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="courts-breakout">
      <div className="flex h-[calc(100vh-3.5rem)] border-t">
        {/* Left panel — scrollable list */}
        <div className="w-[380px] shrink-0 border-r bg-background overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b">
            <h1 className="text-lg font-semibold">Courts</h1>
            <p className="text-xs text-muted-foreground">
              {courts.length} courts · click to locate on map
            </p>
          </div>
          <CourtList
            courts={courts}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* Right panel — map */}
        <div className="flex-1 min-w-0">
          <CourtMap
            courts={courts}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </div>
    </div>
  );
}
