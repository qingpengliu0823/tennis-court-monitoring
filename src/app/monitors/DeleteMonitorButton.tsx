"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteMonitor } from "../actions/monitors";

export function DeleteMonitorButton({ monitorId }: { monitorId: string }) {
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    await deleteMonitor(monitorId);
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          Confirm
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
      Delete
    </Button>
  );
}
