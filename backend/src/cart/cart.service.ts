import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Cart, CartItem, FulfillmentType, Prisma, Product } from '@prisma/client';
import { randomBytes } from 'crypto';
import { sanitizePlain } from '../common/utils/sanitize';
import { PrismaService } from '../prisma/prisma.service';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { CartItemView, CartView } from './entities/cart-view.entity';

/** Resolved context for the current cart owner (logged-in user or guest token). */
export interface CartContext {
  userId?: string;
  guestToken?: string;
}

/** Cart item joined with the product fields needed for pricing/display/stock. */
type CartItemWithProduct = CartItem & {
  product: Product & { inventory: { quantity: number; reserved: number } | null; media: { url: string }[] };
};

/** Shape consumed by OrdersService.createFromCart. */
export interface CheckoutCart {
  items: {
    product: Product;
    variantId: string | null;
    quantity: number;
    unitPriceCents: number;
    optionsJson: Prisma.JsonValue | null;
    customText: string | null;
    modelLink: string | null;
    customUploadUrl: string | null;
  }[];
  subtotalCents: number;
}

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Public API ----------------------------------------------------------

  /** Returns the caller's cart, creating a guest cart (+ token) on demand. */
  async getCart(ctx: CartContext): Promise<CartView> {
    const cart = await this.resolveOrCreateCart(ctx);
    return this.toView(cart, ctx);
  }

  /** Add a line to the cart, or accumulate quantity onto an identical existing line. */
  async addItem(ctx: CartContext, dto: AddItemDto): Promise<CartView> {
    const cart = await this.resolveOrCreateCart(ctx);
    const product = await this.loadProduct(dto.productId);
    const customText = dto.customText ? sanitizePlain(dto.customText) : null;
    const modelLink = this.normalizeModelLink(dto.modelLink);
    const options = this.normalizeOptions(dto.options);

    const unitPriceCents = await this.resolveUnitPrice(product, dto.variantId, options);

    // Upsert by the unique (cartId, productId, variantId, customText) tuple.
    const existing = await this.prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: product.id,
        variantId: dto.variantId ?? null,
        customText,
      },
    });

    const desiredQty = (existing?.quantity ?? 0) + dto.quantity;
    await this.assertStock(product, desiredQty);

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: desiredQty,
          unitPriceCents,
          optionsJson: options ?? Prisma.JsonNull,
          // Upload and link are mutually exclusive: a newly supplied method clears the other.
          customUploadId: modelLink ? null : (dto.customUploadId ?? existing.customUploadId),
          modelLink: dto.customUploadId ? null : (modelLink ?? existing.modelLink),
        },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: product.id,
          variantId: dto.variantId ?? null,
          quantity: dto.quantity,
          optionsJson: options ?? Prisma.JsonNull,
          customText,
          customUploadId: dto.customUploadId ?? null,
          modelLink,
          unitPriceCents,
        },
      });
    }

    return this.toView(cart, ctx);
  }

  /** Update an existing line's quantity / options / custom text. */
  async updateItem(ctx: CartContext, itemId: string, dto: UpdateItemDto): Promise<CartView> {
    const cart = await this.resolveOrCreateCart(ctx);
    const item = await this.findOwnedItem(cart.id, itemId);
    const product = await this.loadProduct(item.productId);

    const options =
      dto.optionsJson !== undefined
        ? this.normalizeOptions(dto.optionsJson)
        : (item.optionsJson as Record<string, string> | null);
    const customText =
      dto.customText !== undefined ? (dto.customText ? sanitizePlain(dto.customText) : null) : item.customText;
    const quantity = dto.quantity ?? item.quantity;

    await this.assertStock(product, quantity);
    const unitPriceCents = await this.resolveUnitPrice(product, item.variantId, options);

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity, customText, optionsJson: options ?? Prisma.JsonNull, unitPriceCents },
    });

    return this.toView(cart, ctx);
  }

  /** Remove a single line from the cart. */
  async removeItem(ctx: CartContext, itemId: string): Promise<CartView> {
    const cart = await this.resolveOrCreateCart(ctx);
    const item = await this.findOwnedItem(cart.id, itemId);
    await this.prisma.cartItem.delete({ where: { id: item.id } });
    return this.toView(cart, ctx);
  }

  /** Empty the caller's cart. */
  async clear(ctx: CartContext): Promise<CartView> {
    const cart = await this.resolveOrCreateCart(ctx);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.toView(cart, ctx);
  }

  /**
   * Fold a guest cart into the user's cart (call on login), then delete the guest cart.
   * Identical lines accumulate quantity; new lines are moved over.
   */
  async mergeGuestIntoUser(userId: string, guestToken: string): Promise<CartView> {
    const guestCart = await this.prisma.cart.findUnique({
      where: { guestToken },
      include: { items: true },
    });
    if (!guestCart) return this.getCart({ userId });

    const userCart = await this.resolveOrCreateCart({ userId });

    await this.prisma.$transaction(async (tx) => {
      for (const item of guestCart.items) {
        const existing = await tx.cartItem.findFirst({
          where: {
            cartId: userCart.id,
            productId: item.productId,
            variantId: item.variantId,
            customText: item.customText,
          },
        });
        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: {
              quantity: existing.quantity + item.quantity,
              unitPriceCents: item.unitPriceCents,
              // Preserve the custom artifacts carried by the guest line.
              customUploadId: item.customUploadId ?? existing.customUploadId,
              modelLink: item.modelLink ?? existing.modelLink,
            },
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: userCart.id,
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              optionsJson: item.optionsJson ?? Prisma.JsonNull,
              customText: item.customText,
              customUploadId: item.customUploadId,
              modelLink: item.modelLink,
              unitPriceCents: item.unitPriceCents,
            },
          });
        }
      }
      await tx.cart.delete({ where: { id: guestCart.id } });
    });

    return this.getCart({ userId });
  }

  /**
   * Resolve the user's cart for checkout with fresh product + price data.
   * Throws if the cart is empty. Consumed by OrdersService.createFromCart.
   */
  async getCheckoutCart(userId: string): Promise<CheckoutCart> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }

    const uploadUrlById = await this.resolveUploadUrls(cart.items.map((i) => i.customUploadId));
    const items = cart.items.map((item) => ({
      product: item.product,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      optionsJson: item.optionsJson,
      customText: item.customText,
      modelLink: item.modelLink,
      customUploadUrl: item.customUploadId ? (uploadUrlById.get(item.customUploadId) ?? null) : null,
    }));
    const subtotalCents = items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);

    return { items, subtotalCents };
  }

  /** Empty a user's cart by user id (called by OrdersService.markPaid). */
  async clearForUser(userId: string): Promise<void> {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (cart) await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }

  // --- Internals -----------------------------------------------------------

  /** Find the caller's cart, creating one (with a guest token if anonymous) if needed. */
  private async resolveOrCreateCart(ctx: CartContext): Promise<Cart> {
    if (ctx.userId) {
      const existing = await this.prisma.cart.findUnique({ where: { userId: ctx.userId } });
      if (existing) return existing;
      return this.prisma.cart.create({ data: { userId: ctx.userId } });
    }

    if (ctx.guestToken) {
      const existing = await this.prisma.cart.findUnique({ where: { guestToken: ctx.guestToken } });
      if (existing) return existing;
    }

    // Anonymous with no (or unknown) token: mint a fresh guest cart + token.
    return this.prisma.cart.create({ data: { guestToken: randomBytes(24).toString('hex') } });
  }

  /** Load a cart line and assert it belongs to the given cart. */
  private async findOwnedItem(cartId: string, itemId: string): Promise<CartItem> {
    const item = await this.prisma.cartItem.findUnique({ where: { id: itemId } });
    if (!item || item.cartId !== cartId) throw new NotFoundException('Cart item not found');
    return item;
  }

  /** Load a product or 404. */
  private async loadProduct(productId: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  /** Trim values and drop empty entries from a submitted options map. */
  private normalizeOptions(options?: Record<string, string> | null): Record<string, string> | null {
    if (!options) return null;
    const cleaned: Record<string, string> = {};
    for (const [key, value] of Object.entries(options)) {
      if (typeof value === 'string' && value.trim()) cleaned[key.trim()] = value.trim();
    }
    return Object.keys(cleaned).length ? cleaned : null;
  }

  /** Resolve customUpload URLs for a set of (possibly null) upload ids in one query. */
  private async resolveUploadUrls(ids: (string | null)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
    if (!unique.length) return new Map();
    const rows = await this.prisma.customUpload.findMany({
      where: { id: { in: unique } },
      select: { id: true, url: true },
    });
    return new Map(rows.map((r) => [r.id, r.url]));
  }

  /** Validate + normalize an external model link. Only https MakerWorld URLs are accepted. */
  private normalizeModelLink(url?: string | null): string | null {
    const trimmed = url?.trim();
    if (!trimmed) return null;
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new BadRequestException('Enter a valid model link URL');
    }
    // Enforce https at the producing layer so a stored link can never be a
    // dangerous scheme (javascript:/data:) reaching an href, regardless of DTO.
    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('Only secure (https) MakerWorld links are supported');
    }
    const host = parsed.hostname.toLowerCase();
    if (host !== 'makerworld.com' && !host.endsWith('.makerworld.com')) {
      throw new BadRequestException('Only MakerWorld model links are supported');
    }
    return trimmed;
  }

  /**
   * Resolve a line's unit price in cents.
   * variantId → ProductVariant.priceCents; otherwise base price + matched option deltas.
   */
  private async resolveUnitPrice(
    product: Product,
    variantId: string | null | undefined,
    options: Record<string, string> | null,
  ): Promise<number> {
    if (variantId) {
      const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
      if (!variant || variant.productId !== product.id) {
        throw new BadRequestException('Invalid variant for this product');
      }
      return variant.priceCents;
    }

    let price = product.priceCents;
    if (options && Object.keys(options).length) {
      const values = await this.prisma.productOptionValue.findMany({
        where: { option: { productId: product.id } },
        include: { option: true },
      });
      for (const [optionName, value] of Object.entries(options)) {
        const match = values.find((v) => v.option.name === optionName && v.value === value);
        if (!match) throw new BadRequestException(`Invalid option: ${optionName}=${value}`);
        price += match.priceDeltaCents;
      }
    }
    return price;
  }

  /** Enforce stock for STOCKED products; MADE_TO_ORDER is unlimited. */
  private async assertStock(product: Product, requestedQty: number): Promise<void> {
    if (product.fulfillment !== FulfillmentType.STOCKED) return;
    const inventory = await this.prisma.inventory.findUnique({ where: { productId: product.id } });
    const available = inventory ? inventory.quantity - inventory.reserved : 0;
    if (requestedQty > available) {
      throw new BadRequestException(`Only ${Math.max(0, available)} unit(s) available`);
    }
  }

  /** Compute available units for display; STOCKED only, MADE_TO_ORDER is always in stock. */
  private isLineInStock(item: CartItemWithProduct): boolean {
    if (item.product.fulfillment !== FulfillmentType.STOCKED) return true;
    const inv = item.product.inventory;
    const available = inv ? inv.quantity - inv.reserved : 0;
    return item.quantity <= available;
  }

  /** Build the API CartView for a cart, attaching the guest token when anonymous. */
  private async toView(cart: Cart, ctx: CartContext): Promise<CartView> {
    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
      include: {
        product: {
          include: {
            inventory: { select: { quantity: true, reserved: true } },
            media: { where: { type: 'IMAGE' }, orderBy: { position: 'asc' }, take: 1, select: { url: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // customUploadId is a loose FK (no relation) — resolve the URLs in one query.
    const uploadUrlById = await this.resolveUploadUrls(items.map((i) => i.customUploadId));

    const itemViews: CartItemView[] = items.map((item) => {
      const lineTotalCents = item.unitPriceCents * item.quantity;
      return {
        id: item.id,
        productId: item.productId,
        name: item.product.name,
        slug: item.product.slug,
        imageUrl: item.product.media[0]?.url ?? null,
        variantId: item.variantId,
        options: (item.optionsJson as Record<string, string> | null) ?? {},
        customText: item.customText,
        modelLink: item.modelLink,
        customUploadUrl: item.customUploadId ? (uploadUrlById.get(item.customUploadId) ?? null) : null,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        lineTotalCents,
        inStock: this.isLineInStock(item),
      };
    });

    const subtotalCents = itemViews.reduce((sum, i) => sum + i.lineTotalCents, 0);
    const itemCount = itemViews.reduce((sum, i) => sum + i.quantity, 0);

    return {
      id: cart.id,
      token: ctx.userId ? undefined : (cart.guestToken ?? undefined),
      items: itemViews,
      subtotalCents,
      itemCount,
    };
  }
}
