"use client";

import { useState, useTransition } from "react";
import { addPolicyAction } from "@/app/actions";

export default function AddPolicyForm() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await addPolicyAction(title, text);
          setTitle("");
          setText("");
        });
      }}
      className="flex flex-col gap-3"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Policy title"
        required
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Policy text — chunked and embedded so the agent can ground its offers in it."
        required
        rows={5}
        className="resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-relaxed outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending || !title || !text}
        className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Indexing…" : "Add to playbook"}
      </button>
    </form>
  );
}
