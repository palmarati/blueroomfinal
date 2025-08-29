"use client";

import { useEffect, useState } from "react";

type Config = { applicationId: string; locationId: string; env: "sandbox" | "production" };

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

export default function SquareHealthPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [paymentsReady, setPaymentsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/square/config", { cache: "no-store" });
        if (!resp.ok) throw new Error("config error");
        const cfg = (await resp.json()) as Config;
        if (cancelled) return;
        setConfig(cfg);
        const src = getScriptUrl(cfg.env);
        await new Promise<void>((resolve, reject) => {
          if (window.Square) return resolve();
          const existing = document.querySelector(`script[src='${src}']`) as HTMLScriptElement | null;
          if (existing) {
            existing.addEventListener("load", () => resolve());
            existing.addEventListener("error", () => reject(new Error("script error")));
            return;
          }
          const script = document.createElement("script");
          script.src = src;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("script error"));
          document.head.appendChild(script);
        });
        if (cancelled) return;
        setScriptLoaded(true);
        const payments = await window.Square.payments(cfg.applicationId, cfg.locationId);
        if (payments) setPaymentsReady(true);
      } catch (e: any) {
        setError(e?.message ?? "error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="max-w-xl mx-auto p-6 space-y-3">
      <h1 className="text-xl font-semibold">Square Health</h1>
      <div className="text-sm">Env: <b>{config?.env ?? "?"}</b></div>
      <div className="text-sm">Config: {config ? "OK" : "…"}</div>
      <div className="text-sm">Script: {scriptLoaded ? "OK" : "…"}</div>
      <div className="text-sm">Payments init: {paymentsReady ? "OK" : "…"}</div>
      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}


