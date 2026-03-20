"use client";

import { Switch } from "@/components/ui/switch";
import { toggleMonitor } from "../actions/monitors";

export function MonitorToggle({
  monitorId,
  enabled,
}: {
  monitorId: string;
  enabled: boolean;
}) {
  return (
    <Switch
      defaultChecked={enabled}
      onCheckedChange={(checked) => toggleMonitor(monitorId, checked)}
    />
  );
}
