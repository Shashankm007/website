/**
 * Built-in rule-based FAQ bot — answers common store questions with no external
 * dependency. Used as the default and as the fallback when an LLM is configured.
 */

export interface BotAnswer {
  reply: string;
  needsHuman: boolean;
}

export const SUPPORT_WHATSAPP = '+91 70171 09861';

export const CHATBOT_SYSTEM_PROMPT = [
  'You are the friendly customer-support assistant for HashTag Creations, an Indian online store',
  'for 3D-printed products (home decor, desk accessories, toys, custom STL prints, and lithophane',
  'photo frames). Currency is INR (₹). Shipping is via Shiprocket — ₹79 flat, free over ₹999,',
  'usually delivered in 3–7 business days. Payments are via Razorpay (UPI, cards, net banking,',
  'wallets). Every order includes an 18% GST invoice (PDF). Customers can track orders under',
  'My account → Orders. Answer concisely (under 60 words), warmly, and accurately. If you are',
  `unsure or the customer needs a person, tell them to contact us on WhatsApp at ${SUPPORT_WHATSAPP}.`,
].join(' ');

export function faqAnswer(raw: string): BotAnswer {
  const m = (raw ?? '').toLowerCase().trim();
  const has = (...keys: string[]) => keys.some((k) => m.includes(k));

  if (!m) return { reply: 'Please type your question and I’ll do my best to help 🙂', needsHuman: false };

  // Specific intents are matched BEFORE greetings (so "how long does shipping take?"
  // isn't swallowed by the 'hi' inside "shipping").
  if (has('ship', 'deliver', 'dispatch', 'courier', 'how long', 'how many days', 'when will')) {
    return {
      reply:
        'We ship across India via Shiprocket. Shipping is ₹79 flat and FREE over ₹999. Most orders arrive in 3–7 business days (made-to-order items may take a little longer), and you get a tracking link once it ships.',
      needsHuman: false,
    };
  }
  if (has('pay', 'payment', 'razorpay', 'upi', 'card', 'netbanking', 'net banking', 'wallet')) {
    return {
      reply:
        'We accept secure payments via Razorpay — UPI, cards, net banking and wallets. Your payment details never touch our servers.',
      needsHuman: false,
    };
  }
  if (has('track', 'tracking', 'where is my order', 'order status', 'status of my order')) {
    return {
      reply:
        'You can track your order under My account → Orders. Once it ships we send a tracking link and the order page shows live status.',
      needsHuman: false,
    };
  }
  if (has('return', 'refund', 'exchange', 'cancel', 'damaged', 'broken', 'wrong item')) {
    return {
      reply: `You can cancel an order while it's still Pending from My account → Orders. For returns/refunds on delivered items, message our team on WhatsApp at ${SUPPORT_WHATSAPP} and we'll sort it out.`,
      needsHuman: false,
    };
  }
  if (has('custom', 'stl', '3d file', 'own design', 'own model', 'upload my')) {
    return {
      reply:
        "Yes! Use our Custom STL Print Service — upload your .stl file on the product page, choose a material, and we'll print it. Final pricing is confirmed after a quick review.",
      needsHuman: false,
    };
  }
  if (has('lithophane', 'litho', 'photo frame', 'photo lamp', 'picture frame', 'photo print')) {
    return {
      reply:
        'Our Lithophane Photo Frames turn your photo into a glowing 3D print. Upload a picture on the product page and choose a frame or light box, with optional LED backlighting. ✨',
      needsHuman: false,
    };
  }
  if (has('gst', 'invoice', 'bill', 'tax')) {
    return {
      reply: 'Every order includes an 18% GST tax invoice you can download as a PDF from My account → Orders.',
      needsHuman: false,
    };
  }
  if (has('discount', 'coupon', 'offer', 'promo', 'sale', 'code')) {
    return {
      reply:
        'Use code WELCOME10 for 10% off your first order (min ₹500). Keep an eye on the banner at the top of the site for current offers!',
      needsHuman: false,
    };
  }
  if (has('human', 'agent', 'representative', 'talk to', 'real person', 'contact', 'support team', 'call you', 'phone')) {
    return {
      reply: `Of course — you can chat with our team on WhatsApp at ${SUPPORT_WHATSAPP}. I've flagged this conversation so someone can follow up. 🙏`,
      needsHuman: true,
    };
  }

  // Greetings last + word-boundary matched (so they don't trigger on "shipping", "this", etc.).
  if (/\b(hi+|hey+|hello+|hiya|namaste|hola|good (morning|afternoon|evening))\b/.test(m) || /thank/.test(m)) {
    if (/thank/.test(m)) {
      return { reply: "You're welcome! 😊 Anything else I can help with?", needsHuman: false };
    }
    return {
      reply:
        "Hi! 👋 I'm the HashTag Creations assistant. Ask me about shipping, payments, custom STL prints, lithophane photo frames, returns, discounts, or tracking your order.",
      needsHuman: false,
    };
  }

  return {
    reply: `I'm not totally sure about that 🤔 — I've noted your question for our team. You can also reach us directly on WhatsApp at ${SUPPORT_WHATSAPP}.`,
    needsHuman: true,
  };
}
