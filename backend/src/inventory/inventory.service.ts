import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FulfillmentType, Inventory, InventoryReason, Prisma } from '@prisma/client';
import { paginate, Paginated } from '../common/interfaces/api-response.interface';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryQueryDto } from './dto/inventory-query.dto';

/** A line item referenced by stock operations. */
export interface StockItem {
  productId: string;
  quantity: number;
}

/** A product row joined with its inventory + a computed availability status. */
export interface InventoryRow {
  productId: string;
  name: string;
  sku: string;
  fulfillment: FulfillmentType;
  quantity: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'MADE_TO_ORDER';
}

/**
 * Owns stock levels and the append-only InventoryLedger.
 * STOCKED products track quantity/reserved; MADE_TO_ORDER products are always available.
 */
@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Current inventory record for a product, or null if none exists. */
  async getLevel(productId: string): Promise<Inventory | null> {
    return this.prisma.inventory.findUnique({ where: { productId } });
  }

  /** Derives a human-facing availability status for a product. */
  private computeStatus(
    fulfillment: FulfillmentType,
    quantity: number,
    reserved: number,
    threshold: number,
  ): InventoryRow['status'] {
    if (fulfillment === FulfillmentType.MADE_TO_ORDER) return 'MADE_TO_ORDER';
    const available = quantity - reserved;
    if (available <= 0) return 'OUT_OF_STOCK';
    if (available <= threshold) return 'LOW_STOCK';
    return 'IN_STOCK';
  }

  /**
   * Manually adjust a product's quantity and write a ledger entry (atomic).
   * Throws if a STOCKED product would drop below zero.
   */
  async adjust(
    productId: string,
    delta: number,
    reason: InventoryReason,
    opts?: { orderId?: string; note?: string; actorId?: string },
  ): Promise<Inventory> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { inventory: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.$transaction(async (tx) => {
      const current = product.inventory ?? (await tx.inventory.create({ data: { productId } }));
      const nextQuantity = current.quantity + delta;
      if (product.fulfillment === FulfillmentType.STOCKED && nextQuantity < 0) {
        throw new BadRequestException('Adjustment would drive stock below zero');
      }
      const inventory = await tx.inventory.update({
        where: { productId },
        data: { quantity: nextQuantity },
      });
      await tx.inventoryLedger.create({
        data: {
          productId,
          delta,
          reason,
          orderId: opts?.orderId ?? null,
          note: opts?.note ?? null,
        },
      });
      return inventory;
    });
  }

  /**
   * Asserts every STOCKED item has enough free stock (quantity - reserved).
   * MADE_TO_ORDER items always pass.
   */
  async assertAvailable(items: StockItem[]): Promise<void> {
    if (items.length === 0) return;
    const products = await this.prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
      include: { inventory: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    for (const item of items) {
      const product = byId.get(item.productId);
      if (!product) throw new BadRequestException(`Product ${item.productId} not found`);
      if (product.fulfillment === FulfillmentType.MADE_TO_ORDER) continue;
      const available = (product.inventory?.quantity ?? 0) - (product.inventory?.reserved ?? 0);
      if (available < item.quantity) {
        throw new BadRequestException(`Insufficient stock for "${product.name}"`);
      }
    }
  }

  /** Holds stock for an unpaid order by incrementing `reserved`. */
  async reserve(productId: string, qty: number, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.inventory.update({
      where: { productId },
      data: { reserved: { increment: qty } },
    });
  }

  /** Releases a previous reservation, flooring `reserved` at zero. */
  async release(productId: string, qty: number, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    const inventory = await client.inventory.findUnique({ where: { productId } });
    if (!inventory) return;
    const reserved = Math.max(0, inventory.reserved - qty);
    await client.inventory.update({ where: { productId }, data: { reserved } });
  }

  /**
   * Finalizes stock for a paid order: for STOCKED items decrement both quantity and
   * reserved by the ordered amount and write an ORDER ledger entry. Skips MADE_TO_ORDER.
   */
  async commitForOrder(items: StockItem[], orderId: string, tx?: Prisma.TransactionClient): Promise<void> {
    if (items.length === 0) return;
    const run = async (client: Prisma.TransactionClient) => {
      const products = await client.product.findMany({
        where: { id: { in: items.map((i) => i.productId) } },
        select: { id: true, fulfillment: true },
      });
      const fulfillmentById = new Map(products.map((p) => [p.id, p.fulfillment]));

      for (const item of items) {
        if (fulfillmentById.get(item.productId) !== FulfillmentType.STOCKED) continue;
        const inventory = await client.inventory.findUnique({ where: { productId: item.productId } });
        if (!inventory) continue;
        await client.inventory.update({
          where: { productId: item.productId },
          data: {
            quantity: { decrement: item.quantity },
            reserved: Math.max(0, inventory.reserved - item.quantity),
          },
        });
        await client.inventoryLedger.create({
          data: { productId: item.productId, delta: -item.quantity, reason: InventoryReason.ORDER, orderId },
        });
      }
    };

    if (tx) return run(tx);
    await this.prisma.$transaction(run);
  }

  /**
   * Returns stock to inventory for a cancelled/returned order: increments quantity and
   * writes a ledger entry. Skips MADE_TO_ORDER items.
   */
  async restockForOrder(items: StockItem[], orderId: string, reason: InventoryReason): Promise<void> {
    if (items.length === 0) return;
    await this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: items.map((i) => i.productId) } },
        select: { id: true, fulfillment: true },
      });
      const fulfillmentById = new Map(products.map((p) => [p.id, p.fulfillment]));

      for (const item of items) {
        if (fulfillmentById.get(item.productId) !== FulfillmentType.STOCKED) continue;
        await tx.inventory.update({
          where: { productId: item.productId },
          data: { quantity: { increment: item.quantity } },
        });
        await tx.inventoryLedger.create({
          data: { productId: item.productId, delta: item.quantity, reason, orderId },
        });
      }
    });
  }

  /** Products at or under their low-stock threshold (STOCKED only). */
  async listLow(): Promise<InventoryRow[]> {
    const products = await this.prisma.product.findMany({
      where: { fulfillment: FulfillmentType.STOCKED, inventory: { isNot: null } },
      include: { inventory: true },
      orderBy: { name: 'asc' },
    });
    return products
      .filter((p) => p.inventory && p.inventory.quantity - p.inventory.reserved <= p.inventory.lowStockThreshold)
      .map((p) => this.toRow(p));
  }

  /** Paginated admin list joining product + inventory + computed status. */
  async adminList(query: InventoryQueryDto): Promise<Paginated<InventoryRow>> {
    const { page, limit, skip, search, lowOnly } = query;
    const where: Prisma.ProductWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Low-stock filtering can't be expressed purely in SQL (quantity - reserved comparison),
    // so when `lowOnly` is set we page over the in-memory filtered set.
    if (lowOnly) {
      const all = await this.prisma.product.findMany({
        where: { ...where, fulfillment: FulfillmentType.STOCKED, inventory: { isNot: null } },
        include: { inventory: true },
        orderBy: { name: 'asc' },
      });
      const filtered = all.filter(
        (p) => p.inventory && p.inventory.quantity - p.inventory.reserved <= p.inventory.lowStockThreshold,
      );
      const items = filtered.slice(skip, skip + limit).map((p) => this.toRow(p));
      return paginate(items, filtered.length, page, limit);
    }

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { inventory: true },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return paginate(
      products.map((p) => this.toRow(p)),
      total,
      page,
      limit,
    );
  }

  /** Maps a product + its inventory into an InventoryRow with computed availability. */
  private toRow(product: {
    id: string;
    name: string;
    sku: string;
    fulfillment: FulfillmentType;
    inventory: Inventory | null;
  }): InventoryRow {
    const quantity = product.inventory?.quantity ?? 0;
    const reserved = product.inventory?.reserved ?? 0;
    const lowStockThreshold = product.inventory?.lowStockThreshold ?? 0;
    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      fulfillment: product.fulfillment,
      quantity,
      reserved,
      available: Math.max(0, quantity - reserved),
      lowStockThreshold,
      status: this.computeStatus(product.fulfillment, quantity, reserved, lowStockThreshold),
    };
  }

  /** Daily low-stock sweep — logs how many products need restocking. */
  @Cron('0 8 * * *')
  async dailyLowStockCheck(): Promise<void> {
    const low = await this.listLow();
    this.logger.log(`Daily low-stock check: ${low.length} product(s) at or under threshold`);
  }
}
