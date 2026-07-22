"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Parses an ISO `yyyy-MM-dd` string into a local `Date` (midnight, local
 *  timezone) — avoids the UTC-shift pitfall of `new Date(iso)`. */
function isoToDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  const parts = iso.split("-");
  if (parts.length !== 3) return undefined;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Formats a local `Date` back into the ISO `yyyy-MM-dd` string the rest of
 *  the app (state + API) expects. */
function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Displays an ISO `yyyy-MM-dd` string as Bulgarian `DD.MM.YYYY` — plain
 *  string manipulation, no date-fns dependency needed for this. */
function isoToDisplay(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}.${m}.${y}`;
}

export interface DateFieldProps {
  /** Current value as ISO `yyyy-MM-dd` (matches the app's `from`/`to` state). */
  value: string;
  /** Called with the new ISO `yyyy-MM-dd` string when a day is picked. */
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/** Bulgarian-friendly date picker: shows `DD.MM.YYYY` in the trigger button
 *  and a shadcn calendar popover, while keeping the underlying value as an
 *  ISO `yyyy-MM-dd` string so existing state/API contracts are unaffected. */
export function DateField({ value, onChange, placeholder = "Изберете дата", className, disabled }: DateFieldProps) {
  const [open, setOpen] = React.useState(false);
  const selected = isoToDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "justify-start gap-2 font-normal t-small px-3",
              !value && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
            {value ? isoToDisplay(value) : placeholder}
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (date) {
              onChange(dateToIso(date));
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
