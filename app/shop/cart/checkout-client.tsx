"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SquarePaymentForm } from "@/components/square-payment-form";

export default function CheckoutClient({ amountCents }: { amountCents: number }) {
  const router = useRouter();
  const [message, setMessage] = useState<string>("");
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">Checkout</h2>
      <SquarePaymentForm
        amountCents={amountCents}
        context="order"
        onSuccess={() => {
          setMessage("Payment successful! We'll email your receipt.");
          router.refresh();
        }}
        onError={(m) => setMessage(m)}
        useSavedIfAvailable
      />
      {message && <div className="text-sm">{message}</div>}
    </div>
  );
}


