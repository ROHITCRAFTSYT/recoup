"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardIcon,
  BoardIcon,
  ShieldIcon,
  PlusIcon,
  BookIcon,
  PlugIcon,
  TrendingIcon,
  CodeIcon,
} from "@/lib/icons";

const LINKS = [
  { href: "/", label: "Dashboard", Icon: DashboardIcon, exact: true },
  { href: "/board", label: "Collections", Icon: BoardIcon, match: ["/board", "/invoices"] },
  { href: "/authorizations", label: "Authorizations", Icon: ShieldIcon },
  { href: "/analytics", label: "Analytics", Icon: TrendingIcon },
  { href: "/simulate", label: "Simulate invoice", Icon: PlusIcon },
  { href: "/playbook", label: "Playbook", Icon: BookIcon },
  { href: "/sdk-explorer", label: "SDK Explorer", Icon: CodeIcon },
  { href: "/integrations", label: "Integrations", Icon: PlugIcon },
];

export default function Nav({ pendingCount = 0 }: { pendingCount?: number }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {LINKS.map(({ href, label, Icon, exact, match }) => {
        const active = exact
          ? pathname === href
          : match
            ? match.some((m) => pathname.startsWith(m))
            : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-black/[.04] hover:text-foreground"
            }`}
          >
            <Icon className="h-[18px] w-[18px]" />
            <span className="flex-1">{label}</span>
            {href === "/authorizations" && pendingCount > 0 && (
              <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-white tnum">
                {pendingCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
