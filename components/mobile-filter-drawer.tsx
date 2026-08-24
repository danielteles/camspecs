"use client";

import { SlidersHorizontalIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { FilterSection } from "@/components/filter-sidebar";
import { FilterSidebar } from "@/components/filter-sidebar";

interface MobileFilterDrawerProps {
  sections: FilterSection[];
  activeCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerLabel: string;
  titleLabel: string;
  closeLabel: string;
  clearAllLabel: string;
  onClearAll: () => void;
  applyLabel: string;
}

export function MobileFilterDrawer({
  sections,
  activeCount,
  open,
  onOpenChange,
  triggerLabel,
  titleLabel,
  closeLabel,
  clearAllLabel,
  onClearAll,
  applyLabel,
}: MobileFilterDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontalIcon className="size-4" aria-hidden />
          {triggerLabel}
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-0.5">
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        closeLabel={closeLabel}
        className="max-h-[85vh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>{titleLabel}</SheetTitle>
        </SheetHeader>
        <FilterSidebar sections={sections} idPrefix="mobile-" />
        <div className="border-border sticky bottom-0 mt-auto flex items-center gap-2 border-t bg-inherit pt-4">
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={onClearAll}
            disabled={activeCount === 0}
          >
            {clearAllLabel}
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            {applyLabel}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
