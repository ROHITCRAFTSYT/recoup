"use client";

/**
 * Browser bridge to the OFFICIAL `lemma-sdk` npm package.
 *
 * The published SDK (v0.5.2) is browser-first: it authenticates with a
 * SuperTokens session or — for agent/dev use — a Bearer "testing token" kept in
 * localStorage, and it statically imports `supertokens-web-js`, so it CANNOT be
 * imported in our Node server runtime. We therefore load it lazily *in the
 * browser only* (dynamic import) and drive it with a short-lived pod token the
 * operator opts into via NEXT_PUBLIC_LEMMA_TOKEN.
 *
 * The secure server proxy (`/api/lemma/*`, token kept server-side) stays the
 * default path everywhere else in the app — this module is the genuine-SDK
 * showcase: real `LemmaClient`, real `client.pods/tables/records`, in the
 * browser, exactly the surface the SDK was built for.
 */

import type { LemmaClient } from "lemma-sdk";

/** True when the browser has an opt-in pod id + token to drive the real SDK. */
export function browserSdkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_LEMMA_POD_ID && process.env.NEXT_PUBLIC_LEMMA_TOKEN,
  );
}

export function browserPodId(): string {
  return process.env.NEXT_PUBLIC_LEMMA_POD_ID || "";
}

let clientPromise: Promise<LemmaClient> | null = null;

/**
 * Lazily construct a real `LemmaClient` from the published package. Browser only.
 * The dynamic import keeps `lemma-sdk` (and its browser-only deps) out of every
 * server bundle — it is evaluated solely when this runs in the browser.
 */
export async function getBrowserLemmaClient(): Promise<LemmaClient> {
  if (typeof window === "undefined") {
    throw new Error("The Lemma browser SDK runs in the browser only.");
  }
  if (!browserSdkConfigured()) {
    throw new Error(
      "Browser SDK not configured — set NEXT_PUBLIC_LEMMA_POD_ID and NEXT_PUBLIC_LEMMA_TOKEN.",
    );
  }
  if (!clientPromise) {
    clientPromise = (async () => {
      const mod = await import("lemma-sdk");
      // The SDK's AuthManager auto-detects a Bearer token from localStorage at
      // construction time, so seed it BEFORE building the client.
      mod.setTestingToken(process.env.NEXT_PUBLIC_LEMMA_TOKEN!);
      return new mod.LemmaClient({
        apiUrl: process.env.NEXT_PUBLIC_LEMMA_API_URL || "https://api.lemma.work",
        podId: process.env.NEXT_PUBLIC_LEMMA_POD_ID!,
      });
    })();
  }
  return clientPromise;
}
