import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { aiEnabled, aiLabel } from "@/lib/lemma/agent";
import { embeddingsEnabled } from "@/lib/lemma/embeddings";
import { telegramConfigured } from "@/lib/lemma/telegram";
import { listPendingAuthorizations, getActingRole } from "@/lib/lemma/datastore";
import { logoutAction } from "@/app/actions";
import { SignOutIcon } from "@/lib/icons";
import Nav from "./nav";
import RoleSwitcher from "./role-switcher";

import LemmaSdkStatus from "./integrations/lemma-sdk-status";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const aiOn = aiEnabled();
  const provider = aiLabel();
  const embeddings = embeddingsEnabled();
  const telegram = telegramConfigured();
  const [pending, actingRole] = await Promise.all([
    listPendingAuthorizations().catch(() => []),
    getActingRole(),
  ]);

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col border-r border-border bg-surface px-4 py-5">
        <div className="mb-7 flex items-center gap-2.5 px-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-base font-semibold text-white font-display">
            R
          </div>
          <div className="leading-tight">
            <div className="font-display text-[17px] font-semibold tracking-tight">
              Recoup
            </div>
            <div className="text-[11px] text-muted">Collections Desk</div>
          </div>
        </div>

        <Nav pendingCount={pending.length} />

        <div className="mt-auto flex flex-col gap-3 pt-4">
          <RoleSwitcher role={actingRole} />

          <div className="rounded-xl border border-border bg-background p-3 text-[11px] leading-relaxed text-muted">
            <div className="flex items-center justify-between">
              <span>AI agents</span>
              <span className={aiOn ? "text-positive" : "text-warning"}>
                {aiOn ? `live · ${provider}` : "heuristic"}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Policy search</span>
              <span className={embeddings ? "text-positive" : "text-muted"}>
                {embeddings ? "semantic" : "keyword"}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Telegram</span>
              <span className={telegram ? "text-positive" : "text-muted"}>
                {telegram ? "connected" : "off"}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <LemmaSdkStatus compact />
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="min-w-0">
              <div className="truncate text-xs font-medium">{user.name}</div>
              <div className="truncate text-[11px] text-muted">{user.email}</div>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Sign out"
                className="rounded-md p-1.5 text-muted transition hover:bg-black/[.04] hover:text-foreground"
              >
                <SignOutIcon className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-x-auto">{children}</main>
    </div>
  );
}
