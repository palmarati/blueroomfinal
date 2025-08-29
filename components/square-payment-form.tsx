"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
	buttonLabel: string;
	onToken: (token: string) => Promise<void> | void;
	onError?: (message: string) => void;
};

export default function SquarePaymentForm({ buttonLabel, onToken, onError }: Props) {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const cardRef = useRef<any>(null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch("/api/square/config", { cache: "no-store" });
				if (!res.ok) throw new Error("Failed to load Square config");
				const { applicationId, locationId } = await res.json();
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

	const handleClick = useCallback(async () => {
		setError(null);
		try {
			const card = cardRef.current;
			if (!card) throw new Error("Card not ready");
			const result = await card.tokenize();
			if (result.status !== "OK") throw new Error(result.errors?.[0]?.message ?? "Tokenization failed");
			await onToken(result.token);
		} catch (e: any) {
			setError(e?.message ?? "Payment error");
			onError?.(e?.message ?? "Payment error");
		}
	}, [onToken]);

	return (
		<div className="space-y-2">
			<div id="card-container" className="border rounded p-3" />
			{error && <div className="text-sm text-red-600">{error}</div>}
			<button onClick={handleClick} disabled={loading} className="underline disabled:opacity-50">{loading ? "Loading…" : buttonLabel}</button>
		</div>
	);
}

 
