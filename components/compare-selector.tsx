"use client";

import { useTranslations } from "next-intl";
import { SearchIcon, XIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { useCompareTransition } from "@/components/compare-transition-provider";
import { useSearchCatalog } from "@/components/use-search-catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  COMPARE_ITEMS_PARAM,
  MAX_COMPARE_ITEMS,
  parseCompareItems,
  serializeCompareItems,
} from "@/lib/compare-params";
import { searchCatalog, type CatalogItem } from "@/lib/search";

const MAX_RESULTS = 8;

export function CompareSelector({
  initialItems,
}: {
  /** The URL's selected items, resolved on the server, so their chips
   * render without loading the search catalog. */
  initialItems: CatalogItem[];
}) {
  const t = useTranslations("CompareSelector");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { startTransition } = useCompareTransition();

  const selectedSlugs = useMemo(
    () => parseCompareItems(searchParams.get(COMPARE_ITEMS_PARAM)),
    [searchParams],
  );

  // Items picked in this session, so a new chip shows immediately rather
  // than after the server re-renders the page with it in initialItems.
  const [pickedItems, setPickedItems] = useState<CatalogItem[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const isMaxed = selectedSlugs.length >= MAX_COMPARE_ITEMS;
  const { catalog, hasError } = useSearchCatalog(open && !isMaxed);
  const isLoading = open && !isMaxed && !catalog && !hasError;

  const itemsBySlug = new Map(
    [...pickedItems, ...initialItems].map((item) => [item.slug, item]),
  );
  const selectedItems = selectedSlugs
    .map((slug) => itemsBySlug.get(slug))
    .filter((item): item is CatalogItem => item !== undefined);

  const results = useMemo(
    () => (catalog ? searchCatalog(catalog, query) : []),
    [catalog, query],
  );

  function updateSelection(nextSlugs: string[]) {
    // next-intl's query serializer stringifies every value it's given
    // (including `undefined`, producing a literal "?items=undefined"), so
    // the param key must be omitted entirely rather than set to undefined.
    const href =
      nextSlugs.length > 0
        ? {
            pathname,
            query: { [COMPARE_ITEMS_PARAM]: serializeCompareItems(nextSlugs) },
          }
        : { pathname };

    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  function handleSelect(item: CatalogItem) {
    if (selectedSlugs.includes(item.slug) || isMaxed) {
      return;
    }

    setPickedItems((prev) => [...prev, item]);
    updateSelection([...selectedSlugs, item.slug]);
    setQuery("");
    setOpen(false);
  }

  function handleRemove(slug: string) {
    updateSelection(selectedSlugs.filter((s) => s !== slug));
  }

  const visibleResults = results
    .filter((item) => !selectedSlugs.includes(item.slug))
    .slice(0, MAX_RESULTS);

  return (
    <div className="flex flex-col gap-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="text-muted-foreground w-full justify-start gap-2 sm:w-80"
          >
            <SearchIcon className="size-4 shrink-0 opacity-50" aria-hidden />
            {t("triggerLabel")}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) p-0 sm:w-80"
          align="start"
        >
          <Command shouldFilter={false} label={t("ariaLabel")}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={t("placeholder")}
              isLoading={isLoading}
            />
            <CommandList>
              <CommandEmpty>
                {isMaxed
                  ? t("maxReached", { max: MAX_COMPARE_ITEMS })
                  : hasError
                    ? t("searchError")
                    : isLoading
                      ? t("searching")
                      : t("empty")}
              </CommandEmpty>
              {!isMaxed &&
                visibleResults.map((item) => (
                  <CommandItem
                    key={item.slug}
                    value={item.slug}
                    onSelect={() => handleSelect(item)}
                  >
                    <span className="flex-1 truncate">
                      {item.brand} {item.model}
                    </span>
                    <Badge variant="outline" className="shrink-0">
                      {item.type === "camera" ? t("typeCamera") : t("typeLens")}
                    </Badge>
                  </CommandItem>
                ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedItems.length > 0 && (
        <ul aria-label={t("selectedLabel")} className="flex flex-wrap gap-2">
          {selectedItems.map((item) => (
            <li key={item.slug}>
              <Badge variant="secondary" className="gap-1 py-1 pr-1 pl-2.5">
                {item.brand} {item.model}
                <button
                  type="button"
                  onClick={() => handleRemove(item.slug)}
                  aria-label={t("removeItem", {
                    item: `${item.brand} ${item.model}`,
                  })}
                  className="hover:bg-foreground/10 focus-visible:ring-ring/50 rounded-full p-0.5 focus-visible:ring-3 focus-visible:outline-none"
                >
                  <XIcon className="size-3" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
