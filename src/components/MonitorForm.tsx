"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMonitor, updateMonitor } from "@/app/actions/monitors";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CourtOption {
  id: string;
  name: string;
  serviceTypes: Array<{ name: string; label?: string; price: string }> | null;
}

interface MonitorDefaults {
  id: string;
  name: string;
  courtId: string;
  serviceType: string | null;
  daysOfWeek: number[];
  timeFrom: string | null;
  timeTo: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  checkIntervalMin: number;
  cooldownMin: number;
}

export function MonitorForm({
  courts,
  defaults,
}: {
  courts: CourtOption[];
  defaults?: MonitorDefaults;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [selectedCourtId, setSelectedCourtId] = useState(defaults?.courtId ?? "");

  const selectedCourt = courts.find((c) => c.id === selectedCourtId);
  const serviceTypes = selectedCourt?.serviceTypes ?? null;
  const isEdit = !!defaults;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const daysOfWeek = DAYS.map((_, i) => i).filter(
      (i) => form.get(`day-${i}`) === "on"
    );

    const data = {
      name: form.get("name") as string,
      courtId: form.get("courtId") as string,
      serviceType: (form.get("serviceType") as string) || undefined,
      daysOfWeek,
      timeFrom: (form.get("timeFrom") as string) || undefined,
      timeTo: (form.get("timeTo") as string) || undefined,
      dateFrom: (form.get("dateFrom") as string) || undefined,
      dateTo: (form.get("dateTo") as string) || undefined,
      checkIntervalMin: Number(form.get("checkIntervalMin")) || 30,
      cooldownMin: Number(form.get("cooldownMin")) || 60,
    };

    if (isEdit) {
      await updateMonitor(defaults.id, data);
    } else {
      await createMonitor(data);
    }

    router.push("/monitors");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={defaults?.name}
          placeholder="e.g. Weekend evenings at Clissold Park"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="courtId">Court</Label>
        <select
          id="courtId"
          name="courtId"
          required
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={selectedCourtId}
          onChange={(e) => setSelectedCourtId(e.target.value)}
        >
          <option value="">Select a court...</option>
          {courts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {serviceTypes && (
        <div className="space-y-2">
          <Label htmlFor="serviceType">Booking as</Label>
          <div className="space-y-1.5">
            {serviceTypes.map((st) => (
              <label
                key={st.name}
                className="flex items-center justify-between rounded border px-3 py-2 text-sm cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="serviceType"
                    value={st.name}
                    defaultChecked={defaults?.serviceType === st.name}
                    className="accent-primary"
                  />
                  <span>{st.label || st.name}</span>
                </div>
                <span className="text-muted-foreground">{st.price}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Availability may differ by service type. Select how you would book.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label>Days of week</Label>
        <div className="flex gap-2">
          {DAYS.map((day, i) => (
            <label
              key={i}
              className="flex items-center gap-1 rounded border px-2 py-1 text-sm cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-primary-foreground"
            >
              <input
                type="checkbox"
                name={`day-${i}`}
                defaultChecked={defaults?.daysOfWeek.includes(i)}
                className="sr-only"
              />
              {day}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="timeFrom">Time from</Label>
          <Input id="timeFrom" name="timeFrom" type="time" defaultValue={defaults?.timeFrom ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="timeTo">Time to</Label>
          <Input id="timeTo" name="timeTo" type="time" defaultValue={defaults?.timeTo ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dateFrom">Date from</Label>
          <Input id="dateFrom" name="dateFrom" type="date" defaultValue={defaults?.dateFrom ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dateTo">Date to</Label>
          <Input id="dateTo" name="dateTo" type="date" defaultValue={defaults?.dateTo ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="checkIntervalMin">Check interval (min)</Label>
          <Input
            id="checkIntervalMin"
            name="checkIntervalMin"
            type="number"
            defaultValue={defaults?.checkIntervalMin ?? 30}
            min={5}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cooldownMin">Alert cooldown (min)</Label>
          <Input
            id="cooldownMin"
            name="cooldownMin"
            type="number"
            defaultValue={defaults?.cooldownMin ?? 60}
            min={5}
          />
        </div>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? "Saving..." : isEdit ? "Update Monitor" : "Create Monitor"}
      </Button>
    </form>
  );
}
