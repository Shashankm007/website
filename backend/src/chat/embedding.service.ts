import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';

const LOCAL_DIM = 512;

/**
 * Produces embedding vectors for RAG. Uses an OpenAI-compatible /embeddings
 * endpoint (open-source models like nomic-embed-text via Ollama) when configured,
 * otherwise a deterministic built-in feature-hashing embedder so retrieval works
 * fully offline. The same method is used for indexing and querying within a run.
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly cfg: AppConfig['chatbot'];

  constructor(config: ConfigService) {
    this.cfg = config.get<AppConfig['chatbot']>('chatbot')!;
  }

  private get remoteUrl(): string | undefined {
    return this.cfg.embedUrl || (this.cfg.embedModel ? this.cfg.apiUrl : undefined);
  }

  get mode(): 'remote' | 'local' {
    return this.remoteUrl ? 'remote' : 'local';
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    if (this.remoteUrl) {
      try {
        return await this.embedRemote(texts);
      } catch (e) {
        this.logger.error(`Remote embeddings failed, using local fallback: ${(e as Error).message}`);
      }
    }
    return texts.map((t) => this.embedLocal(t));
  }

  async embedOne(text: string): Promise<number[]> {
    return (await this.embed([text]))[0];
  }

  private async embedRemote(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.remoteUrl!.replace(/\/$/, '')}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.cfg.apiKey ? { Authorization: `Bearer ${this.cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({ model: this.cfg.embedModel || 'text-embedding-3-small', input: texts }),
    });
    if (!res.ok) throw new Error(`embeddings endpoint returned ${res.status}`);
    const data = (await res.json()) as { data?: { embedding: number[] }[] };
    const vectors = (data.data ?? []).map((d) => d.embedding);
    if (vectors.length !== texts.length) throw new Error('embedding count mismatch');
    return vectors;
  }

  // --- Local deterministic embedder (feature hashing of unigrams + bigrams) ---

  private embedLocal(text: string): number[] {
    const v = new Array(LOCAL_DIM).fill(0);
    const tokens = tokenize(text);
    const grams = [...tokens];
    for (let i = 0; i < tokens.length - 1; i++) grams.push(`${tokens[i]}_${tokens[i + 1]}`);
    for (const g of grams) v[this.hash(g) % LOCAL_DIM] += 1;
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / norm);
  }

  private hash(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }
}

/** Lowercase, strip punctuation, drop stopwords, and lightly stem plurals. */
export function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9₹ ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
}

/** Cosine similarity for two equal-length vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'do', 'does', 'did', 'i', 'you', 'we', 'my', 'me', 'to', 'of', 'for', 'in', 'on',
  'and', 'or', 'how', 'what', 'can', 'will', 'with', 'your', 'have', 'has', 'it', 'this', 'that', 'be', 'at', 'by',
  'from', 'about', 'please', 'tell',
]);
