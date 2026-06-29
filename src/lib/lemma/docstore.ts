// Policy store + semantic search over the collections playbook.
//
// The agent grounds every offer (discount limits, tone ladder, when to escalate)
// in retrieved policy chunks — so a proposed settlement is defensible against
// the firm's actual authority limits, not invented. Chunks live in SQLite with
// optional embeddings; search ranks by cosine similarity when embeddings exist,
// else by keyword overlap. Swappable for the Lemma document store later.

import { prisma } from "@/lib/db";
import { embed, embedOne, cosineSimilarity } from "./embeddings";

export type RetrievedChunk = {
  chunkId: string;
  policyId: string;
  title: string;
  content: string;
  score: number;
};

/** Split raw policy text into ~600-char chunks on paragraph boundaries. */
export function chunkText(raw: string, target = 600): string[] {
  const paragraphs = raw
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current && current.length + p.length > target) {
      chunks.push(current.trim());
      current = "";
    }
    current += (current ? "\n\n" : "") + p;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [raw.trim()];
}

/** Ingest a policy: persist it, chunk it, embed the chunks (if possible). */
export async function ingestPolicy(input: {
  title: string;
  rawText: string;
  source?: string;
}) {
  const policy = await prisma.policy.create({
    data: {
      title: input.title,
      rawText: input.rawText,
      source: input.source ?? "manual",
    },
  });

  const chunks = chunkText(input.rawText);
  const vectors = await embed(chunks).catch(() => null);

  await prisma.policyChunk.createMany({
    data: chunks.map((content, i) => ({
      policyId: policy.id,
      content,
      embedding: vectors ? JSON.stringify(vectors[i]) : null,
    })),
  });

  return policy;
}

function keywordScore(query: string, content: string): number {
  const terms = new Set(
    query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2),
  );
  if (terms.size === 0) return 0;
  const lower = content.toLowerCase();
  let hits = 0;
  for (const t of terms) if (lower.includes(t)) hits++;
  return hits / terms.size;
}

/**
 * Retrieve the top-k policy chunks most relevant to `query`. Uses cosine
 * similarity when embeddings are available, keyword overlap otherwise.
 */
export async function search(query: string, k = 4): Promise<RetrievedChunk[]> {
  const chunks = await prisma.policyChunk.findMany({
    include: { policy: { select: { title: true } } },
  });
  if (chunks.length === 0) return [];

  const queryVec = await embedOne(query).catch(() => null);

  const scored = chunks.map((c) => {
    let score: number;
    if (queryVec && c.embedding) {
      score = cosineSimilarity(queryVec, JSON.parse(c.embedding) as number[]);
    } else {
      score = keywordScore(query, c.content);
    }
    return {
      chunkId: c.id,
      policyId: c.policyId,
      title: c.policy.title,
      content: c.content,
      score,
    };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
