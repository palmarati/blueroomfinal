"use client";

import { SquarePaymentForm } from "@/components/square-payment-form";
import { useState } from "react";

export default function BookingPayment({ amountCents, appointmentId }: { amountCents: number; appointmentId?: string }) {
  const [message, setMessage] = useState<string>("");
  return (
    <div className="mt-6">
      <h3 className="font-medium mb-2">Complete Payment</h3>
      <SquarePaymentForm
        amountCents={amountCents}
        context="appointment"
        contextId={appointmentId}
        useSavedIfAvailable
        onSuccess={() => setMessage("Payment successful. We'll confirm shortly.")}
        onError={(m) => setMessage(m)}
      />
      {message && <div className="text-sm mt-2">{message}</div>}
    </div>
  );
}


