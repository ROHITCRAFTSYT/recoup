/**
 * Lemma SDK — server-side helpers.
 *
 * Thin wrappers that bridge the LemmaClient into Server Actions and API routes
 * with the exact shapes the rest of the app expects.
 */

import {
  LemmaClient,
  createLemmaClientFromEnv,
  lemmaSdkConfigured,
  LemmaError,
} from "./client";
import type { LemmaRecord, TableSchema } from "./types";

export {
  LemmaClient,
  createLemmaClientFromEnv,
  lemmaSdkConfigured,
  LemmaError,
  type LemmaRecord,
  type TableSchema,
};
