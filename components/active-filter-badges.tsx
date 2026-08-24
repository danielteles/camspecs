"use client";

import { XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ActiveFilterChip {
  id: string;
  label: string;
  onRemove: () => void;
}

interface ActiveFilterBadgesProps {
  chips: ActiveFilterChip[];
  onClearAll: () => void;
  clearAllLabel: string;
  /** Builds the remove button's accessible name from a chip's label. */
  removeLabel: (chipLabel: string) => string;
  groupLabel: string;
}

export function ActiveFilterBadges({
  chips,
  onClearAll,
  clearAllLabel,
  removeLabel,
  groupLabel,
}: ActiveFilterBadgesProps) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label={groupLabel}
      className="flex flex-wrap items-center gap-2"
    >
      {chips.map((chip) => (
        <Badge key={chip.id} variant="secondary" className="gap-1 py-1 pr-1">
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={removeLabel(chip.label)}
            className="hover:bg-background/60 focus-visible:ring-ring/50 -mr-0.5 rounded-full p-0.5 outline-none focus-visible:ring-2"
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={onClearAll}>
        {clearAllLabel}
      </Button>
    </div>
  );
}
