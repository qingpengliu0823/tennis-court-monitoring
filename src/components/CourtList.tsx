"use client";

import { useEffect, useRef } from "react";
import { CourtListItem } from "./CourtListItem";

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

export function CourtList({
  courts,
  selectedId,
  onSelect,
}: {
  courts: Court[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!selectedId) return;
    const el = itemRefs.current.get(selectedId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedId]);

  return (
    <div ref={listRef} className="h-full overflow-y-auto divide-y">
      {courts.map((court) => (
        <div
          key={court.id}
          ref={(el) => {
            if (el) itemRefs.current.set(court.id, el);
          }}
        >
          <CourtListItem
            court={court}
            selected={court.id === selectedId}
            onSelect={() => onSelect(court.id)}
          />
        </div>
      ))}
    </div>
  );
}
