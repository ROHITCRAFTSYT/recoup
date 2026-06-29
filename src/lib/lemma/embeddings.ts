// Embeddings provider, behind an interface so the doc store doesn't care
// which backend produces the vectors.
//
// Now: Voyage AI (`voyage-3`) when VOYAGE_API_KEY is set; otherwise returns
// null to signal the doc store to fall back to keyword search — that keeps the
// demo runnable with only an ANTHROPIC_API_KEY.
// Later (June 24): the Lemma document store handles embedding internally.

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3";

export function embeddingsEnabled(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}

/**
 * Embed a batch of texts. Returns one vector per input, or null when no
 * embeddings provider is configured (caller should use keyword search).
 */
export async function embed(texts: string[]): Promise<number[][] | null> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key || texts.length === 0) return null;

  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Voyage embeddings failed (${res.status}): ${detail}`);
  }

  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding);
}

export async function embedOne(text: string): Promise<number[] | null> {
  const out = await embed([text]);
  return out ? out[0] : null;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
