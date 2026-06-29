"use client";

import { useEffect, useState } from "react";
import { formatMoneyCompact } from "@/lib/ui";

type FormatType = "moneyCompact" | "percent" | "days" | "plain";

function render(n: number, type: FormatType): string {
  const v = Math.round(n);
  switch (type) {
    case "moneyCompact":
      return formatMoneyCompact(v);
    case "percent":
      return `${v}%`;
    case "days":
      return `${v}d`;
    default:
      return v.toLocaleString("en-IN");
  }
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Count-up number that animates once on mount (rAF — no external deps). */
export function NumberTicker({
  value,
  format = "plain",
  durationMs = 1100,
  className,
}: {
  value: number;
  format?: FormatType;
  durationMs?: number;
  className?: string;
}) {
  // SSR / first paint shows the final value (no layout shift, accessible).
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    let raf = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / durationMs);
      setDisplay(value * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <span className={className}>{render(display, format)}</span>;
}
