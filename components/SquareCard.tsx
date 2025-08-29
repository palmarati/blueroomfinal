"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SquareConfig = {
  applicationId: string;
  locationId: string;
  env: "sandbox" | "production";
};

type Props = {
  amountCents: number;
  onSuccess?: (payment: any) => void;
  onError?: (message: string) => void;
};

declare global {
  interface Window {
    Square: any;
  }
}

function getScriptUrl(env: "sandbox" | "production") {
  return env === "production"
    ? "https://web.squarecdn.com/v1/square.js"
    : "https://sandbox.web.squarecdn.com/v1/square.js";
}

export default function SquareCard({ amountCents, onSuccess, onError }: Props) {
  const [config, setConfig] = useState<SquareConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenizing, setTokenizing] = useState(false);
  const initializedRef = useRef(false);
  const cardRef = useRef<any>(null);
  const paymentsRef = useRef<any>(null);

  const formattedAmount = useMemo(() => (amountCents / 100).toFixed(2), [amountCents]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const resp = await fetch("/api/square/config", { cache: "no-store" });
        if (!resp.ok) throw new Error("Failed to load Square config");
        const cfg = (await resp.json()) as SquareConfig;
        if (cancelled) return;
        setConfig(cfg);
        const src = getScriptUrl(cfg.env);
        if (!window.Square && !document.querySelector(`script[src='${src}']`)) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Square SDK"));
            document.head.appendChild(script);
          });
        }
        if (cancelled) return;
        if (!window.Square) throw new Error("Square SDK not available. Disable ad blockers and try again.");
        if (!initializedRef.current) {
          const payments = await window.Square.payments(cfg.applicationId, cfg.locationId);
          paymentsRef.current = payments;
          const card = await payments.card();
          await card.attach("#card-container");
          cardRef.current = card;
          initializedRef.current = true;
        }
      } catch (e: any) {
        const msg = e?.message ?? "Unknown error";
        setError(msg);
        onError?.(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onError]);

  const handlePay = useCallback(async () => {
    if (tokenizing) return;
    setError(null);
    try {
      if (!cardRef.current) throw new Error("Card not ready");
      setTokenizing(true);
      const result = await cardRef.current.tokenize({
        amount: formattedAmount,
        currencyCode: "USD",
        intent: "CHARGE",
      });
      if (result.status !== "OK") {
        throw new Error(result.errors?.[0]?.message || "Tokenization failed");
      }
      const sourceId = result.token as string;
      const resp = await fetch("/api/square/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, amountCents }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.errors?.[0]?.detail || data?.error || "Payment failed");
      }
      onSuccess?.(data);
    } catch (e: any) {
      const msg = e?.message ?? "Payment error";
      setError(msg);
      onError?.(msg);
    } finally {
      setTokenizing(false);
    }
  }, [amountCents, formattedAmount, onError, onSuccess, tokenizing]);

  return (
    <div className="space-y-3">
      <div id="card-container" className="border rounded p-3" />
      {error && <div className="text-sm text-red-600">{error}</div>}
      <button
        type="button"
        disabled={loading || tokenizing}
        className="inline-flex items-center justify-center rounded bg-black text-white px-4 py-2 disabled:opacity-50"
        onClick={handlePay}
      >
        {tokenizing ? "Processing…" : `Pay $${formattedAmount}`}
      </button>
    </div>
  );
}


