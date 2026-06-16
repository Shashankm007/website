/**
 * Database seed — creates an admin, a demo customer, category tree,
 * products (stocked + made-to-order) with media/options/inventory, and a coupon.
 *
 * Run with: `npm run prisma:seed`
 */
import {
  PrismaClient,
  Role,
  ProductStatus,
  FulfillmentType,
  MediaType,
  DiscountType,
  CustomizationType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  console.log('🌱 Seeding database...');

  // --- Users ---------------------------------------------------------------
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
  const customerPassword = 'Customer123!';

  const admin = await prisma.user.upsert({
    where: { email: 'admin@hashtagcreations.in' },
    update: {},
    create: {
      email: 'admin@hashtagcreations.in',
      name: 'HashTag Creations Admin',
      role: Role.ADMIN,
      emailVerified: new Date(),
      passwordHash: await bcrypt.hash(adminPassword, 12),
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@hashtagcreations.in' },
    update: {},
    create: {
      email: 'customer@hashtagcreations.in',
      name: 'Demo Customer',
      role: Role.CUSTOMER,
      emailVerified: new Date(),
      passwordHash: await bcrypt.hash(customerPassword, 12),
    },
  });

  // --- Categories (hierarchy) ---------------------------------------------
  const home = await prisma.category.upsert({
    where: { slug: 'home-decor' },
    update: {},
    create: { name: 'Home & Decor', slug: 'home-decor', description: 'Functional and decorative pieces for your space.' },
  });
  const desk = await prisma.category.upsert({
    where: { slug: 'desk-accessories' },
    update: {},
    create: { name: 'Desk Accessories', slug: 'desk-accessories', parentId: home.id },
  });
  const toys = await prisma.category.upsert({
    where: { slug: 'toys-games' },
    update: {},
    create: { name: 'Toys & Games', slug: 'toys-games' },
  });
  const custom = await prisma.category.upsert({
    where: { slug: 'custom' },
    update: {},
    create: { name: 'Custom Prints', slug: 'custom', description: 'Made-to-order, personalized prints.' },
  });

  // --- Tags ----------------------------------------------------------------
  const tagNames = ['PLA', 'PETG', 'Resin', 'Gift', 'Eco', 'Articulated', 'Personalized'];
  const tags = await Promise.all(
    tagNames.map((name) =>
      prisma.tag.upsert({ where: { slug: slugify(name) }, update: {}, create: { name, slug: slugify(name) } }),
    ),
  );
  const tagBySlug = Object.fromEntries(tags.map((t) => [t.slug, t]));

  // --- Products ------------------------------------------------------------
  type SeedProduct = {
    name: string;
    desc: string;
    priceCents: number;
    compareAtCents?: number; // original/MRP price (enables a discount badge)
    sku: string;
    fulfillment: FulfillmentType;
    customizationType?: CustomizationType;
    stock: number;
    categories: string[];
    tags: string[];
    featured?: boolean;
    images: string[]; // first is the primary/cover photo
    options?: { name: string; values: { value: string; priceDeltaCents?: number; hex?: string }[] }[];
  };

  const materials = {
    name: 'Material',
    values: [
      { value: 'PLA', priceDeltaCents: 0 },
      { value: 'PETG', priceDeltaCents: 10000 },
      { value: 'Resin', priceDeltaCents: 30000 },
    ],
  };
  const colors = {
    name: 'Color',
    values: [
      { value: 'Black', hex: '#111111' },
      { value: 'White', hex: '#f5f5f5' },
      { value: 'Red', hex: '#e11d48' },
      { value: 'Blue', hex: '#2563eb' },
    ],
  };
  const sizes = {
    name: 'Size',
    values: [
      { value: 'Small', priceDeltaCents: 0 },
      { value: 'Medium', priceDeltaCents: 15000 },
      { value: 'Large', priceDeltaCents: 40000 },
    ],
  };

  const products: SeedProduct[] = [
    {
      name: 'Hexagon Desk Organizer',
      desc: 'A modular honeycomb desk organizer. Snap multiple together to build your perfect desktop.',
      priceCents: 79900,
      compareAtCents: 99900, // 20% off — demo discount
      sku: 'F3D-ORG-HEX',
      fulfillment: FulfillmentType.STOCKED,
      stock: 42,
      categories: [desk.slug, home.slug],
      tags: ['pla', 'eco'],
      featured: true,
      images: ['https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800', 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800', 'https://images.unsplash.com/photo-1565191999001-551c187427bb?w=800'],
      options: [materials, colors],
    },
    {
      name: 'Articulated Dragon',
      desc: 'Print-in-place articulated dragon with smooth, flexible joints. A fan favorite fidget piece.',
      priceCents: 119900,
      sku: 'F3D-TOY-DRGN',
      fulfillment: FulfillmentType.STOCKED,
      stock: 18,
      categories: [toys.slug],
      tags: ['pla', 'articulated', 'gift'],
      featured: true,
      images: ['https://images.unsplash.com/photo-1599751449128-eb7249c3d6b1?w=800', 'https://images.unsplash.com/photo-1565191999001-551c187427bb?w=800', 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=800'],
      options: [colors, sizes],
    },
    {
      name: 'Personalized Name Plate',
      desc: 'Custom engraved desk name plate. Add your name or any text — made to order.',
      priceCents: 49900,
      sku: 'F3D-CUS-PLATE',
      fulfillment: FulfillmentType.MADE_TO_ORDER,
      stock: 0,
      categories: [custom.slug, desk.slug],
      tags: ['personalized', 'gift'],
      featured: true,
      images: ['https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=800', 'https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?w=800', 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800'],
      options: [materials, colors],
    },
    {
      name: 'Geometric Planter',
      desc: 'Low-poly geometric planter with drainage. Perfect for succulents.',
      priceCents: 64900,
      sku: 'F3D-HOM-PLNT',
      fulfillment: FulfillmentType.STOCKED,
      stock: 60,
      categories: [home.slug],
      tags: ['petg', 'eco'],
      images: ['https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800', 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800', 'https://images.unsplash.com/photo-1565191999001-551c187427bb?w=800'],
      options: [colors, sizes],
    },
    {
      name: 'Cable Management Clips (Set of 6)',
      desc: 'Keep your desk tidy with adhesive-backed cable clips.',
      priceCents: 29900,
      sku: 'F3D-DSK-CLIP',
      fulfillment: FulfillmentType.STOCKED,
      stock: 3, // low stock to demo alerts
      categories: [desk.slug],
      tags: ['pla'],
      images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800', 'https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?w=800'],
      options: [colors],
    },
    {
      name: 'Custom STL Print Service',
      desc: 'Upload your own STL and we will print it. Pricing finalized after review.',
      priceCents: 149900,
      sku: 'F3D-CUS-STL',
      fulfillment: FulfillmentType.MADE_TO_ORDER,
      customizationType: CustomizationType.STL_UPLOAD,
      stock: 0,
      categories: [custom.slug],
      tags: ['resin', 'personalized'],
      images: ['https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=800', 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800', 'https://images.unsplash.com/photo-1565191999001-551c187427bb?w=800'],
      options: [materials],
    },
    {
      name: 'Lithophane Photo Frame',
      desc: 'Turn your favourite photo into a stunning 3D-printed lithophane. Upload a picture and choose a frame or a box, with optional LED backlighting that brings the image to life when lit.',
      priceCents: 89900,
      sku: 'F3D-CUS-LITHO',
      fulfillment: FulfillmentType.MADE_TO_ORDER,
      customizationType: CustomizationType.PHOTO_UPLOAD,
      stock: 0,
      categories: [custom.slug, home.slug],
      tags: ['personalized', 'gift'],
      featured: true,
      images: ['https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?w=800', 'https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?w=800', 'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=800'],
      options: [
        {
          name: 'Frame Style',
          values: [
            { value: 'Photo Frame', priceDeltaCents: 0 },
            { value: 'Light Box', priceDeltaCents: 40000 },
          ],
        },
        {
          name: 'Lighting',
          values: [
            { value: 'Without LED', priceDeltaCents: 0 },
            { value: 'With LED Backlight', priceDeltaCents: 30000 },
          ],
        },
        { name: 'Size', values: [
          { value: 'A6 (10×15 cm)', priceDeltaCents: 0 },
          { value: 'A5 (15×21 cm)', priceDeltaCents: 25000 },
        ] },
      ],
    },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        name: p.name,
        slug: slugify(p.name),
        description: p.desc,
        shortDescription: p.desc.slice(0, 120),
        sku: p.sku,
        priceCents: p.priceCents,
        compareAtCents: p.compareAtCents ?? null,
        status: ProductStatus.ACTIVE,
        fulfillment: p.fulfillment,
        customizationType: p.customizationType ?? CustomizationType.NONE,
        featured: p.featured ?? false,
        media: {
          create: p.images.map((url, i) => ({
            type: MediaType.IMAGE,
            url,
            position: i,
            alt: `${p.name} — photo ${i + 1}`,
          })),
        },
        categories: {
          create: p.categories.map((slug) => ({
            category: { connect: { slug } },
          })),
        },
        tags: {
          create: p.tags.map((slug) => ({ tag: { connect: { slug } } })),
        },
        inventory:
          p.fulfillment === FulfillmentType.STOCKED
            ? { create: { quantity: p.stock, lowStockThreshold: 5 } }
            : undefined,
        options: p.options
          ? {
              create: p.options.map((opt, i) => ({
                name: opt.name,
                position: i,
                values: {
                  create: opt.values.map((v, j) => ({
                    value: v.value,
                    priceDeltaCents: v.priceDeltaCents ?? 0,
                    hex: v.hex,
                    position: j,
                  })),
                },
              })),
            }
          : undefined,
      },
    });

    if (p.fulfillment === FulfillmentType.STOCKED) {
      await prisma.inventoryLedger.create({
        data: { productId: product.id, delta: p.stock, reason: 'RESTOCK', note: 'Initial seed stock' },
      });
    }
  }

  // --- Coupon --------------------------------------------------------------
  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      description: '10% off your first order',
      type: DiscountType.PERCENTAGE,
      value: 10,
      minSubtotalCents: 50000,
      active: true,
    },
  });

  console.log('✅ Seed complete.');
  console.log(`   Admin:    admin@hashtagcreations.in / ${adminPassword}`);
  console.log(`   Customer: customer@hashtagcreations.in / ${customerPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
