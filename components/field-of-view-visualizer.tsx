"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { FieldOfViewDiagram } from "@/components/field-of-view-diagram";
import { getHorizontalFieldOfView } from "@/lib/equivalence";
import type { SensorDimensions } from "@/lib/types";

export function FieldOfViewVisualizer({
  minFocalLengthMm,
  maxFocalLengthMm,
  sensor,
}: {
  minFocalLengthMm: number;
  maxFocalLengthMm: number;
  sensor: SensorDimensions;
}) {
  const t = useTranslations("ProductPage");
  const sliderId = useId();
  const isZoom = minFocalLengthMm !== maxFocalLengthMm;
  const [focalLengthMm, setFocalLengthMm] = useState(minFocalLengthMm);

  const fovDegrees = getHorizontalFieldOfView(focalLengthMm, sensor);

  return (
    <div className="flex flex-col items-center gap-4">
      {isZoom && (
        <div className="flex w-full max-w-md flex-col gap-2">
          <label htmlFor={sliderId} className="text-sm font-medium">
            {t("focalLengthSliderLabel", {
              value: Math.round(focalLengthMm),
            })}
          </label>
          <input
            id={sliderId}
            type="range"
            min={minFocalLengthMm}
            max={maxFocalLengthMm}
            step={1}
            value={focalLengthMm}
            onChange={(event) => setFocalLengthMm(Number(event.target.value))}
            className="accent-primary w-full"
          />
        </div>
      )}
      <FieldOfViewDiagram fovDegrees={fovDegrees} />
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {t("horizontalFovLabel")}: {fovDegrees.toFixed(1)}°
      </p>
    </div>
  );
}
