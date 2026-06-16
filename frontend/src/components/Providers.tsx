'use client';

import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-store';
import { WhatsAppButton } from '@/components/support/WhatsAppButton';
import { ChatWidget } from '@/components/support/ChatWidget';

function CartBootstrap() {
  const refresh = useCart((s) => s.refresh);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return null;
}

/** Top-level client providers: auth context, cart bootstrap, toast portal. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CartBootstrap />
      {children}
      <Toaster richColors position="top-center" />
      <WhatsAppButton />
      <ChatWidget />
    </AuthProvider>
  );
}
