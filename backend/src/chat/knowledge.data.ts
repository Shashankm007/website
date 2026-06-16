/**
 * Knowledge base for the RAG chatbot. These are the source documents the bot
 * retrieves over (alongside dynamically-generated product docs). Edit/extend
 * freely — re-run the reindex (admin or on boot) to embed changes.
 */

export const SUPPORT_WHATSAPP = '+91 70171 09861';

export const CHATBOT_SYSTEM_PROMPT = [
  'You are the customer-support assistant for HashTag Creations, an Indian online store for',
  '3D-printed products (home decor, desk accessories, toys, custom STL prints, and lithophane',
  'photo frames). Answer ONLY using the provided context. Be warm, concise (under ~70 words),',
  'and accurate. Prices are in INR (₹). If the context does not contain the answer, say you',
  `aren't sure and suggest contacting the team on WhatsApp at ${SUPPORT_WHATSAPP}. Do not invent`,
  'policies, prices, or products.',
].join(' ');

export interface KnowledgeDoc {
  source: 'policy' | 'faq';
  title: string;
  content: string;
}

export const STATIC_KNOWLEDGE: KnowledgeDoc[] = [
  {
    source: 'policy',
    title: 'Shipping & delivery',
    content:
      'HashTag Creations ships across India through Shiprocket. Shipping is a flat ₹79 and is FREE on orders above ₹999. Most in-stock orders are delivered within 3 to 7 business days; made-to-order items such as custom prints and lithophanes can take a little longer because they are printed on demand. Once an order ships you receive a tracking link and the order page shows live courier status.',
  },
  {
    source: 'policy',
    title: 'Order tracking',
    content:
      'You can track an order any time from My account → Orders. Each order shows a status timeline (Pending → Paid → Printing → Shipped → Delivered). After it ships, a clickable tracking link to the courier (via Shiprocket) appears on the order page and we also notify you.',
  },
  {
    source: 'policy',
    title: 'Payments',
    content:
      'Payments are handled securely by Razorpay. You can pay using UPI, credit and debit cards, net banking, and popular wallets. Your card or UPI details never touch our servers. If a payment is interrupted you can resume it from My account → Orders on the pending order.',
  },
  {
    source: 'policy',
    title: 'GST and invoices',
    content:
      'All prices include 18% GST. A GST tax invoice is generated for every order and can be downloaded as a PDF from My account → Orders once the order is placed.',
  },
  {
    source: 'policy',
    title: 'Returns, refunds and cancellations',
    content:
      'You can cancel an order yourself while it is still in the Pending state from My account → Orders. For returns, replacements, or refunds on delivered or damaged items, contact our team on WhatsApp at ' +
      SUPPORT_WHATSAPP +
      ' and we will help arrange it. Custom/personalised items (custom STL prints, lithophanes) can only be returned if they arrive damaged or defective.',
  },
  {
    source: 'policy',
    title: 'Custom STL printing service',
    content:
      'Our Custom STL Print Service lets you upload your own .stl 3D model on the product page. Choose a material (PLA, PETG, or Resin) and place the order; final pricing is confirmed after our team reviews the model for printability. This is a made-to-order service.',
  },
  {
    source: 'policy',
    title: 'Lithophane photo frames',
    content:
      'Lithophane Photo Frames turn a photo into a 3D-printed lithophane that glows when lit. Upload your picture on the product page and choose a Frame Style (Photo Frame or Light Box), a Size, and whether you want LED backlighting. It is a personalised, made-to-order product and makes a great gift.',
  },
  {
    source: 'policy',
    title: 'Materials and customisation',
    content:
      'Products can be customised with options like Material (PLA, PETG, Resin), Color, and Size, depending on the product. Some products also support custom engraving text. Available options and any price differences are shown on each product page.',
  },
  {
    source: 'policy',
    title: 'Discounts and coupons',
    content:
      'Use the code WELCOME10 for 10% off your first order (minimum order ₹500). Current sales and offers are announced on the banner at the top of the website, and discounted products show a “% OFF” badge.',
  },
  {
    source: 'policy',
    title: 'Accounts and addresses',
    content:
      'You can create an account to track orders, save addresses, keep a wishlist, and check out faster. Manage your profile and saved addresses under My account. Email verification and password reset are available from the sign-in screen.',
  },
  {
    source: 'faq',
    title: 'Categories and what we sell',
    content:
      'HashTag Creations sells 3D-printed Home & Decor, Desk Accessories, Toys & Games, and Custom Prints. Browse everything under the Shop menu, filter by category, price, tags and availability, and sort by newest, price, popularity, or rating.',
  },
  {
    source: 'faq',
    title: 'Contact and support',
    content:
      'The fastest way to reach a human is WhatsApp at ' +
      SUPPORT_WHATSAPP +
      '. You can also use the chat here for quick questions about products, orders, shipping, payments, and returns.',
  },
];
