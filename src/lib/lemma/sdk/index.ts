/**
 * Lemma SDK — public barrel export.
 *
 * Two surfaces live here:
 *   - Server: the typed REST `LemmaClient` (token stays server-side), used by
 *     the `/api/lemma/*` proxy routes.
 *       import { LemmaClient, createLemmaClientFromEnv } from "@/lib/lemma/sdk";
 *   - Browser: hooks over the OFFICIAL `lemma-sdk` npm package (opt-in token).
 *       import { useLemmaBrowserSdk, useBrowserRecords } from "@/lib/lemma/sdk";
 */

export * from "./types";
export * from "./client";
export * from "./server";
export * from "./browser";
export * from "./react";
