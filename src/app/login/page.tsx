import LoginForm from "./login-form";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";

const FEATURES = [
  "Risk-scores every overdue invoice and drafts the next move",
  "Sends routine reminders on its own — over email & WhatsApp",
  "Stops for human sign-off on every settlement, plan, or write-off",
];

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <section
        className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{
          background:
            "radial-gradient(120% 120% at 0% 0%, #3a2418 0%, #211a13 45%, #14110d 100%)",
        }}
      >
        <BackgroundBeams className="opacity-40" />

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-base font-semibold text-white font-display">
            R
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-white">
            Recoup
          </span>
        </div>

        <div className="relative z-10 max-w-md">
          <TextGenerateEffect
            words="The agent does the chasing. You hold the money."
            className="font-display !text-3xl !font-semibold !leading-snug !text-white"
          />
          <p className="mt-4 text-sm leading-relaxed text-white/55">
            An autonomous accounts-receivable desk for recovering overdue invoices —
            with a human in the loop where it counts.
          </p>

          <ul className="mt-8 space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-white/75">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 text-xs text-white/35">
          Live on a Lemma pod · Gappy.AI Hackathon
        </div>
      </section>

      {/* Form panel */}
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-xl font-semibold text-accent-fg font-display">
              R
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Recoup
            </h1>
          </div>

          <div className="mb-6 hidden lg:block">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-muted">
              Sign in to your collections desk.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6">
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  );
}
