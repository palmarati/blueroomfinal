"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
	amountCents: number;
	context: "order" | "appointment";
	contextId?: string;
	useSavedIfAvailable?: boolean;
	onSuccess?: (paymentId: string) => void;
	onError?: (message: string) => void;
  mode?: "pay" | "save";
};

export function SquarePaymentForm(props: Props) {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [canUseSaved, setCanUseSaved] = useState<boolean>(!!props.useSavedIfAvailable);
	const paymentsRef = useRef<any>(null);
	const cardRef = useRef<any>(null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch("/api/square/config", { cache: "no-store" });
				if (!res.ok) throw new Error("Failed to load Square config");
				const { applicationId, locationId } = await res.json();
				// Load Square Web Payments SDK
				// Avoid duplicate script loads
				if (!document.querySelector('script[src^="https://web.squarecdn.com/v1/square.js"]')) {
					await new Promise<void>((resolve, reject) => {
						const s = document.createElement("script");
						s.src = "https://web.squarecdn.com/v1/square.js";
						s.async = true;
						s.onload = () => resolve();
						s.onerror = () => reject(new Error("Failed to load Square SDK"));
						document.head.appendChild(s);
					});
				}
				// @ts-ignore
				const payments = await (window as any).Square?.payments(applicationId, locationId);
				if (!payments) throw new Error("Square payments unavailable");
				paymentsRef.current = payments;
				const card = await payments.card();
				await card.attach("#card-container");
				cardRef.current = card;
				if (!cancelled) setLoading(false);
			} catch (e: any) {
				if (!cancelled) {
					setError(e?.message ?? "Payment init error");
					setLoading(false);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const handlePay = useCallback(async () => {
		setError(null);
		try {
			// Save card only flow
			if (props.mode === "save") {
				const card = cardRef.current;
				if (!card) throw new Error("Card element not ready");
				const result = await card.tokenize();
				if (result.status !== "OK") throw new Error(result.errors?.[0]?.message ?? "Tokenization failed");
				const res = await fetch("/api/square/save-card", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ sourceId: result.token }),
				});
				if (!res.ok) throw new Error((await res.json())?.error ?? "Save card failed");
				props.onSuccess?.("");
				return;
			}

			// Try using saved card if requested
			if (canUseSaved) {
				const res = await fetch("/api/square/payments", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						amountCents: props.amountCents,
						for: props.context,
						orderId: props.context === "order" ? props.contextId : undefined,
						appointmentId: props.context === "appointment" ? props.contextId : undefined,
						useSaved: true,
					}),
				});
				if (res.ok) {
					const json = await res.json();
					props.onSuccess?.(json?.payment?.id ?? "");
					return;
				}
				// If no saved card, fall through to card entry
			}

			const card = cardRef.current;
			if (!card) throw new Error("Card element not ready");
			const result = await card.tokenize();
			if (result.status !== "OK") throw new Error(result.errors?.[0]?.message ?? "Tokenization failed");
			const res = await fetch("/api/square/payments", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					amountCents: props.amountCents,
					for: props.context,
					orderId: props.context === "order" ? props.contextId : undefined,
					appointmentId: props.context === "appointment" ? props.contextId : undefined,
					sourceId: result.token,
				}),
			});
			if (!res.ok) throw new Error((await res.json())?.error ?? "Payment failed");
			const json = await res.json();
			props.onSuccess?.(json?.payment?.id ?? "");
		} catch (e: any) {
			setError(e?.message ?? "Payment error");
			props.onError?.(e?.message ?? "Payment error");
		}
	}, [props.amountCents, props.context, props.contextId, canUseSaved]);

	return (
		<div className="space-y-3">
			<div id="card-container" className="border rounded p-3" />
			{error && <div className="text-sm text-red-600">{error}</div>}
			<button onClick={handlePay} disabled={loading} className="underline disabled:opacity-50">
				{loading ? "Loading…" : props.mode === "save" ? "Save card" : `Pay $${(props.amountCents / 100).toFixed(2)}`}
			</button>
		</div>
	);
}


