"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** A card that lifts slightly and shows a warm clay glow following the cursor. */
export function SpotlightCard({
  children,
  className,
  radius = 320,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  radius?: number;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: -9999, y: -9999 });
  const [active, setActive] = useState(false);

  function onMove(e: React.MouseEvent) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
  }

  return (
    <div
      ref={ref}
      style={style}
      onMouseMove={onMove}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-surface transition-transform duration-300 hover:-translate-y-0.5",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: active ? 1 : 0,
          background: `radial-gradient(${radius}px circle at ${pos.x}px ${pos.y}px, color-mix(in oklab, var(--accent) 13%, transparent), transparent 72%)`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
