'use client';

import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-store';
import { useWishlist } from '@/lib/wishlist-store';
import { WhatsAppButton } from '@/components/support/WhatsAppButton';
import { ChatWidget } from '@/components/support/ChatWidget';

function CartBootstrap() {
  const refresh = useCart((s) => s.refresh);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return null;
}

/** Loads the signed-in user's wishlist into the shared store (clears on logout). */
function WishlistBootstrap() {
  const { user } = useAuth();
  const refresh = useWishlist((s) => s.refresh);
  const clear = useWishlist((s) => s.clear);
  useEffect(() => {
    if (user) void refresh();
    else clear();
  }, [user, refresh, clear]);
  return null;
}

/** Top-level client providers: auth context, cart bootstrap, toast portal. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CartBootstrap />
      <WishlistBootstrap />
      {children}
      <Toaster richColors position="top-center" />
      <WhatsAppButton />
      <ChatWidget />
    </AuthProvider>
  );
}
