import { listPolicies } from "@/lib/lemma/datastore";
import { embeddingsEnabled } from "@/lib/lemma/embeddings";
import { BookIcon } from "@/lib/icons";
import AddPolicyForm from "./add-policy-form";

export const dynamic = "force-dynamic";

export default async function PlaybookPage() {
  const policies = await listPolicies();
  const semantic = embeddingsEnabled();

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-border bg-surface px-8 py-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Collections playbook
        </h1>
        <p className="mt-0.5 text-xs text-muted">
          {policies.length} policies · the agent grounds every offer here ·
          retrieval:{" "}
          <span className="font-medium">
            {semantic ? "semantic (Voyage embeddings)" : "keyword fallback"}
          </span>
        </p>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-8 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3">
          {policies.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <BookIcon className="h-4 w-4 text-accent" />
                  {p.title}
                </h2>
                <span className="text-[11px] text-muted tnum">
                  {p._count.chunks} chunk{p._count.chunks === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-muted">
                {p.rawText}
              </p>
            </div>
          ))}
          {policies.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">
              No policies yet. Add one so the agent can ground its offers.
            </div>
          )}
        </div>

        <aside>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold">Add a policy</h2>
            <AddPolicyForm />
          </div>
        </aside>
      </div>
    </div>
  );
}
