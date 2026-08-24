"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export interface FilterSectionOption {
  value: string;
  label: string;
  count: number;
}

export interface CheckboxFilterSection {
  type: "checkbox";
  id: string;
  label: string;
  options: FilterSectionOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export interface RangeFilterSection {
  type: "range";
  id: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  /** One value for a single min/max threshold, two for a [min, max] range. */
  value: number[];
  onChange: (value: number[]) => void;
  formatValue?: (value: number) => string;
  /** Accessible name per thumb, matched by index; falls back to `label`. */
  thumbLabels?: string[];
}

export type FilterSection = CheckboxFilterSection | RangeFilterSection;

interface FilterSidebarProps {
  sections: FilterSection[];
  /** Section ids expanded by default; every section is open if omitted. */
  defaultOpenSections?: string[];
  /**
   * Distinguishes checkbox `id`/`for` pairs when the same sections are
   * rendered twice at once (desktop sidebar + mobile drawer in the DOM
   * together) so ids stay unique per the HTML spec.
   */
  idPrefix?: string;
  className?: string;
  /** Shows an inline spinner while a filter change is being applied. */
  isPending?: boolean;
  /** Text announced next to the spinner and to screen readers via aria-live. */
  pendingLabel?: string;
}

function CheckboxSection({
  section,
  idPrefix,
}: {
  section: CheckboxFilterSection;
  idPrefix: string;
}) {
  const toggle = (value: string, checked: boolean) => {
    section.onChange(
      checked
        ? [...section.selected, value]
        : section.selected.filter((selected) => selected !== value),
    );
  };

  return (
    <div className="flex flex-col gap-2.5">
      {section.options.map((option) => {
        const inputId = `${idPrefix}${section.id}-${option.value}`;
        const isSelected = section.selected.includes(option.value);
        const isDisabled = option.count === 0 && !isSelected;

        return (
          <div key={option.value} className="flex items-center gap-2">
            <Checkbox
              id={inputId}
              checked={isSelected}
              disabled={isDisabled}
              onCheckedChange={(checked) =>
                toggle(option.value, checked === true)
              }
            />
            <Label
              htmlFor={inputId}
              className={cn(
                "flex flex-1 items-center justify-between gap-2 font-normal",
                isDisabled && "text-muted-foreground",
              )}
            >
              <span>
                {option.label}
                {/* Screen readers otherwise concatenate the visible count
                    onto the label with no separator (e.g. "Sony1"), since
                    it's a sibling flex item rather than adjacent text. */}
                <span className="sr-only">{`, ${option.count} available`}</span>
              </span>
              <span
                aria-hidden="true"
                className="text-muted-foreground text-xs tabular-nums"
              >
                {option.count}
              </span>
            </Label>
          </div>
        );
      })}
    </div>
  );
}

function RangeSection({ section }: { section: RangeFilterSection }) {
  const format = section.formatValue ?? String;
  const currentLabel =
    section.value.length === 2
      ? `${format(section.value[0]!)} – ${format(section.value[1]!)}`
      : format(section.value[0]!);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium tabular-nums">{currentLabel}</p>
      <Slider
        min={section.min}
        max={section.max}
        step={section.step}
        value={section.value}
        onValueChange={section.onChange}
        thumbLabels={section.thumbLabels ?? [section.label]}
      />
      <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
        <span>{format(section.min)}</span>
        <span>{format(section.max)}</span>
      </div>
    </div>
  );
}

export function FilterSidebar({
  sections,
  defaultOpenSections,
  idPrefix = "",
  className,
  isPending = false,
  pendingLabel,
}: FilterSidebarProps) {
  return (
    <div className={className}>
      {pendingLabel && (
        <div
          aria-live="polite"
          className="text-muted-foreground mb-3 flex h-4 items-center gap-1.5 text-xs"
        >
          {isPending && (
            <>
              <Spinner className="size-3.5" />
              <span>{pendingLabel}</span>
            </>
          )}
        </div>
      )}
      <Accordion
        type="multiple"
        defaultValue={
          defaultOpenSections ?? sections.map((section) => section.id)
        }
      >
        {sections.map((section) => (
          <AccordionItem key={section.id} value={section.id}>
            <AccordionTrigger>{section.label}</AccordionTrigger>
            <AccordionContent>
              {section.type === "checkbox" ? (
                <CheckboxSection section={section} idPrefix={idPrefix} />
              ) : (
                <RangeSection section={section} />
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
