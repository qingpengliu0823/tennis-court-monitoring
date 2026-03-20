"use client";

import { Badge } from "@/components/ui/badge";
import { parseCourtMeta, distanceFromUCL, formatDistance } from "@/lib/court-utils";
import { cn } from "@/lib/utils";

interface Court {
  id: string;
  name: string;
  slug: string;
  bookingSystem: string;
  location: string | null;
  metadata: unknown;
  enabled: boolean;
  _count: { snapshots: number; monitors: number };
}

export function CourtListItem({
  court,
  selected,
  onSelect,
}: {
  court: Court;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = parseCourtMeta(court.metadata);
  const hasCoords = meta.lat != null && meta.lng != null;
  const distance = hasCoords ? distanceFromUCL(meta.lat!, meta.lng!) : null;

  const pricing = meta.pricing
    ? Object.values(meta.pricing).join(" / ")
    : null;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left px-4 py-3 border-l-3 transition-colors hover:bg-muted/50",
        selected
          ? "border-l-blue-500 bg-blue-50 dark:bg-blue-950/20"
          : "border-l-transparent"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{court.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {distance != null && (
              <span className="font-medium">{formatDistance(distance)}</span>
            )}
            {distance != null && meta.courts && " · "}
            {meta.courts && `${meta.courts} courts`}
            {(distance != null || meta.courts) && meta.surface && " · "}
            {meta.surface}
          </div>
          {pricing && (
            <div className="text-xs text-muted-foreground mt-0.5">{pricing}</div>
          )}
        </div>
        <Badge
          variant={court.enabled ? "default" : "secondary"}
          className="shrink-0 text-[10px]"
        >
          {court.enabled ? "Live" : "Disabled"}
        </Badge>
      </div>
    </button>
  );
}
