"use client";

import { useState } from "react";
import { SquarePaymentForm } from "@/components/square-payment-form";

export default function AddCardClient() {
  const [message, setMessage] = useState<string>("");
  return (
    <div className="space-y-2">
      <SquarePaymentForm
        amountCents={0}
        context="order"
        mode="save"
        onSuccess={async () => {
          setMessage("Card saved.");
          // Refresh page to show new card
          if (typeof window !== "undefined") window.location.reload();
        }}
        onError={(m) => setMessage(m)}
      />
      {message && <div className="text-sm">{message}</div>}
    </div>
  );
}


