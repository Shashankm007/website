// Shared TS types mirroring the backend API contract (see CONVENTIONS.md +
// backend/SERVICE_CONTRACTS.md). The frontend never imports backend code; these
// are hand-maintained to match the JSON the API returns.

export type Role = 'CUSTOMER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'BLOCKED';
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type FulfillmentType = 'STOCKED' | 'MADE_TO_ORDER';
export type CustomizationType = 'NONE' | 'STL_UPLOAD' | 'PHOTO_UPLOAD';
export type MediaType = 'IMAGE' | 'VIDEO' | 'MODEL_3D';
export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PRINTING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';
export type DiscountType = 'PERCENTAGE' | 'FIXED';

// ---- API envelope ----------------------------------------------------------
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}
export interface ApiError {
  success: false;
  error: { code: string; message: string; details?: unknown; statusCode: number };
  path: string;
  timestamp: string;
}

// ---- Auth / user -----------------------------------------------------------
export interface User {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  role: Role;
  emailVerified?: string | null;
  avatarUrl?: string | null;
}

export interface Address {
  id: string;
  type: 'SHIPPING' | 'BILLING';
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
  isDefault: boolean;
}

// ---- Catalog ---------------------------------------------------------------
export interface MediaItem {
  id: string;
  type: MediaType;
  url: string;
  alt?: string | null;
  position: number;
}
export interface OptionValue {
  id: string;
  value: string;
  priceDeltaCents: number;
  hex?: string | null;
  dimension?: string | null;
}
export interface ProductOption {
  id: string;
  name: string;
  values: OptionValue[];
}
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  parentId?: string | null;
  children?: Category[];
}
export interface ProductCard {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  price: string;
  compareAtCents?: number | null;
  imageUrl?: string | null;
  images?: string[];
  ratingAvg: number;
  ratingCount: number;
  fulfillment: FulfillmentType;
  inStock: boolean;
}
export interface ProductDetail extends ProductCard {
  description: string;
  shortDescription?: string | null;
  sku: string;
  currency: string;
  customizationType: CustomizationType;
  allowEngraving?: boolean;
  media: MediaItem[];
  options: ProductOption[];
  categories: Category[];
  tags: string[];
  related?: ProductCard[];
}

// ---- Cart ------------------------------------------------------------------
export interface CartItem {
  id: string;
  productId: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  variantId?: string | null;
  options?: Record<string, string>;
  customText?: string | null;
  modelLink?: string | null;
  customUploadUrl?: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  inStock: boolean;
}
export interface CartView {
  id: string;
  token?: string;
  items: CartItem[];
  subtotalCents: number;
  itemCount: number;
}

// ---- Orders ----------------------------------------------------------------
export interface OrderItem {
  id: string;
  nameSnapshot: string;
  skuSnapshot: string;
  imageSnapshot?: string | null;
  options?: Record<string, string> | null;
  customText?: string | null;
  modelLink?: string | null;
  customUploadUrl?: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}
export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  email: string;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  items: OrderItem[];
  trackingNumber?: string | null;
  carrier?: string | null;
  // Shiprocket fulfilment
  shiprocketShipmentId?: string | null;
  awbCode?: string | null;
  courierName?: string | null;
  trackingUrl?: string | null;
  shippingSnapshot?: Record<string, unknown> | null;
  createdAt: string;
  paidAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
}

export interface Review {
  id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  verified: boolean;
  createdAt: string;
  user?: { name?: string | null };
}

/** Whether the current user may review a product (from GET /reviews/eligibility/:id). */
export interface ReviewEligibility {
  canReview: boolean;
  hasPurchased: boolean;
  alreadyReviewed: boolean;
}

// ---- Support chat ----------------------------------------------------------
export type ChatRole = 'USER' | 'BOT' | 'ADMIN';
export type ChatStatus = 'OPEN' | 'HANDLED' | 'CLOSED';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

/** Response from POST /chat/message. */
export interface ChatSendResponse {
  conversationId: string;
  reply: string;
  needsHuman: boolean;
}

export interface AdminChatListItem {
  id: string;
  visitorName?: string | null;
  status: ChatStatus;
  needsHuman: boolean;
  lastMessageAt: string;
  createdAt: string;
  user?: { id: string; email: string; name?: string | null } | null;
  _count: { messages: number };
  lastMessage?: { role: ChatRole; content: string; createdAt: string } | null;
}

export interface AdminChatDetail {
  id: string;
  visitorName?: string | null;
  status: ChatStatus;
  needsHuman: boolean;
  lastMessageAt: string;
  createdAt: string;
  user?: { id: string; email: string; name?: string | null } | null;
  messages: ChatMessage[];
}

// ---- Announcement banner ---------------------------------------------------
export type BannerVariant = 'info' | 'success' | 'warning' | 'sale';

export interface Banner {
  enabled: boolean;
  message: string;
  linkUrl?: string | null;
  linkLabel?: string | null;
  variant: BannerVariant;
  dismissible: boolean;
  updatedAt: string | null;
}

/** Admin-configurable shipping fee + free-shipping threshold (paise/cents). */
export interface ShippingSettings {
  flatCents: number;
  freeShippingEnabled: boolean;
  freeThresholdCents: number;
  updatedAt: string | null;
}

export interface Coupon {
  id: string;
  code: string;
  type: DiscountType;
  value: number;
  active: boolean;
}

// ---- Payments (Razorpay) ---------------------------------------------------
/** Response from POST /payments/create-order — used to open Razorpay Checkout. */
export interface CreateRazorpayOrderResponse {
  keyId: string;
  razorpayOrderId: string;
  amount: number; // paise
  currency: string;
  orderNumber: string;
}

// ---- Uploads ---------------------------------------------------------------
export type UploadKind = 'image' | 'video' | 'model' | 'custom' | 'photo';

/** Response from POST /uploads/presign. */
export interface PresignResponse {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
}

/** A customer file upload (STL / photo) recorded via POST /uploads/custom. */
export interface CustomUpload {
  id: string;
  fileName: string;
  objectKey: string;
  url: string;
  sizeBytes: number;
  status: string;
}

// ---- Admin: users ----------------------------------------------------------
export interface AdminUserListItem {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  role: Role;
  status: UserStatus;
  provider?: string;
  emailVerified?: string | null;
  avatarUrl?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  orderCount: number;
  totalSpentCents: number;
}

export interface AdminUserDetail extends AdminUserListItem {
  addresses: Address[];
  orders: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    totalCents: number;
    currency: string;
    createdAt: string;
  }[];
}
