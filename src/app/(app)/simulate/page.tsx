import SimulateForm from "./simulate-form";

export default function SimulatePage() {
  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-border bg-surface px-8 py-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Simulate an overdue invoice
        </h1>
        <p className="mt-0.5 text-xs text-muted">
          Stand in for the accounting-system surface — drop an invoice in and watch
          the recovery pipeline run.
        </p>
      </header>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-surface p-6">
          <SimulateForm />
        </div>
      </div>
    </div>
  );
}
