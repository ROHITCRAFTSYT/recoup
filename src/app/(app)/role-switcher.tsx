"use client";

import { useTransition } from "react";
import { setActingRoleAction } from "@/app/actions";
import { ROLES, roleLabel } from "@/lib/ui";

export default function RoleSwitcher({ role }: { role: string }) {
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-[11px] text-muted">
      <span>Acting as</span>
      <select
        value={role}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          start(() => setActingRoleAction(next));
        }}
        className="rounded-md border border-border bg-surface px-1.5 py-1 text-[11px] font-medium text-foreground outline-none focus:border-accent disabled:opacity-60"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {roleLabel(r)}
          </option>
        ))}
      </select>
    </label>
  );
}
