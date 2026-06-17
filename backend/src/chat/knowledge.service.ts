import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { formatMoney } from '../common/utils/money';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService, cosineSimilarity, tokenize } from './embedding.service';
import { STATIC_KNOWLEDGE } from './knowledge.data';

export interface RetrievedChunk {
  title: string;
  content: string;
  source: string;
  score: number;
}

interface DocInput {
  source: string;
  refId: string | null;
  title: string;
  content: string;
}

@Injectable()
export class KnowledgeService implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingService,
  ) {}

  /** Build the index on first boot if it's empty (best-effort). */
  async onModuleInit() {
    try {
      const count = await this.prisma.knowledgeChunk.count();
      if (count === 0) {
        this.logger.log('Knowledge base empty — building initial index…');
        await this.reindex();
      }
    } catch (e) {
      this.logger.warn(`Knowledge auto-index skipped: ${(e as Error).message}`);
    }
  }

  /** Rebuild the whole knowledge base: policy docs + a doc per active product. */
  async reindex(): Promise<{ indexed: number; mode: string }> {
    const docs = await this.buildDocuments();
    // Neural mode stores embeddings; local (BM25) mode needs none.
    const vectors =
      this.embeddings.mode === 'remote'
        ? await this.embeddings.embed(docs.map((d) => `${d.title}. ${d.content}`))
        : docs.map(() => [] as number[]);

    await this.prisma.$transaction([
      this.prisma.knowledgeChunk.deleteMany({}),
      this.prisma.knowledgeChunk.createMany({
        data: docs.map((d, i) => ({
          source: d.source,
          refId: d.refId,
          title: d.title,
          content: d.content,
          embedding: vectors[i] ?? [],
        })),
      }),
    ]);

    this.logger.log(`Knowledge base reindexed: ${docs.length} chunks (${this.embeddings.mode} embeddings)`);
    return { indexed: docs.length, mode: this.embeddings.mode };
  }

  /**
   * Top-k *relevant* chunks for a query. Neural cosine when an embeddings endpoint
   * is configured, otherwise a BM25 lexical ranker (strong + fully offline).
   * Returns [] when nothing is relevant (so the bot can hand off).
   */
  async search(query: string, k = 4): Promise<RetrievedChunk[]> {
    const chunks = await this.prisma.knowledgeChunk.findMany({
      select: { title: true, content: true, source: true, embedding: true },
    });
    if (!chunks.length) return [];

    if (this.embeddings.mode === 'remote') {
      const queryVec = await this.embeddings.embedOne(query);
      return chunks
        .map((c) => ({ title: c.title, content: c.content, source: c.source, score: cosineSimilarity(queryVec, c.embedding) }))
        .filter((c) => c.score >= 0.25)
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
    }

    return this.bm25(query, chunks, k);
  }

  /** BM25 lexical ranking over title+content. */
  private bm25(query: string, chunks: { title: string; content: string; source: string }[], k: number): RetrievedChunk[] {
    const docs = chunks.map((c) => tokenize(`${c.title} ${c.content}`));
    const N = docs.length;
    const df = new Map<string, number>();
    for (const toks of docs) for (const t of new Set(toks)) df.set(t, (df.get(t) ?? 0) + 1);
    const avgdl = docs.reduce((s, d) => s + d.length, 0) / N || 1;
    const qTerms = [...new Set(tokenize(query))];
    const k1 = 1.5;
    const b = 0.75;

    return chunks
      .map((c, i) => {
        const toks = docs[i];
        const dl = toks.length;
        const tf = new Map<string, number>();
        for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
        let score = 0;
        for (const qt of qTerms) {
          const f = tf.get(qt);
          if (!f) continue;
          const n = df.get(qt) ?? 0;
          const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
          score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * dl) / avgdl)));
        }
        return { title: c.title, content: c.content, source: c.source, score };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  async count(): Promise<number> {
    return this.prisma.knowledgeChunk.count();
  }

  // --- Document assembly ---------------------------------------------------

  private async buildDocuments(): Promise<DocInput[]> {
    const docs: DocInput[] = STATIC_KNOWLEDGE.map((d) => ({
      source: d.source,
      refId: null,
      title: d.title,
      content: d.content,
    }));

    const products = await this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      include: {
        options: { include: { values: true } },
        categories: { include: { category: true } },
        inventory: true,
      },
    });

    for (const p of products) {
      const parts: string[] = [];
      parts.push(`Product: ${p.name}.`);
      if (p.shortDescription) parts.push(p.shortDescription);
      else if (p.description) parts.push(p.description.slice(0, 400));
      parts.push(`Price: ${formatMoney(p.priceCents, p.currency)}.`);
      if (p.compareAtCents && p.compareAtCents > p.priceCents) {
        const off = Math.round(((p.compareAtCents - p.priceCents) / p.compareAtCents) * 100);
        parts.push(`On sale — ${off}% off (was ${formatMoney(p.compareAtCents, p.currency)}).`);
      }
      const cats = p.categories.map((c) => c.category.name).filter(Boolean);
      if (cats.length) parts.push(`Category: ${cats.join(', ')}.`);
      if (p.options.length) {
        parts.push(
          'Options: ' + p.options.map((o) => `${o.name} (${o.values.map((v) => v.value).join(', ')})`).join('; ') + '.',
        );
      }
      if (p.fulfillment === 'MADE_TO_ORDER') parts.push('This item is made to order.');
      else parts.push(p.inventory && p.inventory.quantity > 0 ? 'In stock.' : 'Currently out of stock.');
      if (p.customizationType === 'STL_UPLOAD') parts.push('You upload your own STL file for this product.');
      if (p.customizationType === 'PHOTO_UPLOAD') parts.push('You upload your photo for this product (lithophane).');

      docs.push({ source: 'product', refId: p.id, title: p.name, content: parts.join(' ') });
    }

    return docs;
  }
}
