"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";

type Service = {
  id: string;
  name: string;
  base_duration_min: number;
  base_price_cents: number;
};

type Option = {
  id: string;
  name: string;
  duration_delta_min: number;
  price_delta_cents: number;
};
type Addon = {
  id: string;
  name: string;
  duration_delta_min: number;
  price_delta_cents: number;
};

function BookingClient() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const search = useSearchParams();
  const preselectedService = search.get("service");
  const [services, setServices] = useState<Service[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [serviceId, setServiceId] = useState<string | null>(preselectedService);
  const [optionId, setOptionId] = useState<string | null>(null);
  const [eligibleAddons, setEligibleAddons] = useState<Addon[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [startAt, setStartAt] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<string>("");
  const [guest, setGuest] = useState<boolean>(true);
  const [guestEmail, setGuestEmail] = useState<string>("");
  const [guestFirst, setGuestFirst] = useState<string>("");
  const [guestLast, setGuestLast] = useState<string>("");
  const [guestPhone, setGuestPhone] = useState<string>("");
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [amountCents, setAmountCents] = useState<number>(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: svc } = await supabase
        .from("services")
        .select("id,name,base_duration_min,base_price_cents")
        .eq("visible", true)
        .eq("draft", false)
        .order("name");
      setServices(svc ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  useEffect(() => {
    if (!serviceId) {
      setOptions([]);
      setOptionId(null);
      setEligibleAddons([]);
      setSelectedAddonIds([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("service_options")
        .select("id,name,duration_delta_min,price_delta_cents")
        .eq("service_id", serviceId)
        .eq("visible", true)
        .order("sort_order");
      setOptions(data ?? []);
      const { data: addonLinks } = await supabase
        .from("service_addon_links")
        .select("addon_id,addons(id,name,duration_delta_min,price_delta_cents,visible)")
        .eq("service_id", serviceId);
      type LinkRow = { addons: Addon | (Addon & { visible?: boolean })[] | null };
      const rows = (addonLinks ?? []) as LinkRow[];
      const addons: Addon[] = rows
        .flatMap((row) => {
          const value = row.addons;
          const list = Array.isArray(value) ? value : value ? [value] : [];
          return list as Array<Addon & { visible?: boolean }>;
        })
        .filter((a) => a && a.visible !== false)
        .map((a) => ({
          id: a.id,
          name: a.name,
          duration_delta_min: a.duration_delta_min,
          price_delta_cents: a.price_delta_cents,
        }));
      setEligibleAddons(addons);
    })();
  }, [serviceId, supabase]);

  async function submit() {
    setMessage("");
    if (!serviceId || !startAt) {
      setMessage("Please select a service and a date/time.");
      return;
    }
    const { data: session } = await supabase.auth.getSession();
    const startTs = new Date(startAt);
    // simplistic duration compute
    const svc = services.find((s) => s.id === serviceId);
    const opt = options.find((o) => o.id === optionId);
    const durationMin = (svc?.base_duration_min ?? 0) + (opt?.duration_delta_min ?? 0);
    const addonDuration = eligibleAddons
      .filter((a) => selectedAddonIds.includes(a.id))
      .reduce((acc, a) => acc + (a.duration_delta_min ?? 0), 0);
    const endTs = new Date(startTs.getTime() + (durationMin + addonDuration) * 60000);

    let createdAppointmentId: string | undefined;
    if (session.session && !guest) {
      // Authenticated flow
      const userId = session.session.user.id;
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!client?.id) {
        setMessage("Your client profile was not found.");
        return;
      }
      const { data: inserted, error } = await supabase.from("appointments").insert({
        client_id: client.id,
        service_id: serviceId,
        service_option_id: optionId,
        start_at: startTs.toISOString(),
        end_at: endTs.toISOString(),
        notes: note,
      }).select("id").single();
      if (error) {
        setMessage("Failed to create appointment: " + error.message);
        return;
      }
      createdAppointmentId = inserted?.id as string | undefined;
    } else {
      // Guest flow: minimal details
      if (!guestEmail || !guestFirst) {
        setMessage("Please provide your email and first name.");
        return;
      }
      const { data, error } = await supabase.rpc("guest_create_appointment", {
        p_email: guestEmail,
        p_first_name: guestFirst,
        p_last_name: guestLast || null,
        p_phone: guestPhone || null,
        p_service_id: serviceId,
        p_service_option_id: optionId,
        p_start_at: startTs.toISOString(),
        p_end_at: endTs.toISOString(),
        p_notes: note || null,
        p_addon_ids: selectedAddonIds,
      });
      if (error) {
        setMessage("Failed to create appointment: " + error.message);
        return;
      }
      createdAppointmentId = data as unknown as string | undefined;
    }
    // For guest flow, add-ons were handled by RPC. For auth flow, we add here.
    if (session.session && !guest) {
      if (createdAppointmentId && selectedAddonIds.length > 0) {
        await supabase.from("appointment_addons").insert(
          selectedAddonIds.map((addonId) => ({ appointment_id: createdAppointmentId, addon_id: addonId }))
        );
      }
    }
    // compute amount
    const base = svc?.base_price_cents ?? 0;
    const optDelta = opt?.price_delta_cents ?? 0;
    const addonDelta = eligibleAddons.filter((a) => selectedAddonIds.includes(a.id)).reduce((acc, a) => acc + (a.price_delta_cents ?? 0), 0);
    setAmountCents(base + optDelta + addonDelta);
    setAppointmentId(createdAppointmentId ?? null);
    setMessage("Appointment requested! Proceed to payment below to confirm.");
    // Optionally render payment if required now
  }

  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-4 py-8">Loading…</div>}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold mb-4">Booking</h1>
        {loading ? (
          <div>Loading…</div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Service</label>
              <select
                className="border rounded px-3 py-2 w-full"
                value={serviceId ?? ""}
                onChange={(e) => setServiceId(e.target.value || null)}
              >
                <option value="">Select…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            {options.length > 0 && (
              <div>
                <label className="block text-sm mb-1">Option</label>
                <select
                  className="border rounded px-3 py-2 w-full"
                  value={optionId ?? ""}
                  onChange={(e) => setOptionId(e.target.value || null)}
                >
                  <option value="">None</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
            )}
            {eligibleAddons.length > 0 && (
              <div>
                <label className="block text-sm mb-1">Add-ons</label>
                <div className="flex flex-col gap-1">
                  {eligibleAddons.map((a) => (
                    <label key={a.id} className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedAddonIds.includes(a.id)}
                        onChange={(e) => {
                          setSelectedAddonIds((prev) =>
                            e.target.checked ? [...prev, a.id] : prev.filter((id) => id !== a.id)
                          );
                        }}
                      />
                      {a.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm mb-1">Start time</label>
              <input
                type="datetime-local"
                className="border rounded px-3 py-2 w-full"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="border rounded p-3 space-y-2">
              <label className="block text-sm font-medium">Book as</label>
              <div className="flex items-center gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="who" checked={guest} onChange={() => setGuest(true)} /> Guest
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="who" checked={!guest} onChange={() => setGuest(false)} /> Signed in
                </label>
              </div>
              {guest ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm mb-1">Email</label>
                    <input className="border rounded px-3 py-2 w-full" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">First name</label>
                    <input className="border rounded px-3 py-2 w-full" value={guestFirst} onChange={(e) => setGuestFirst(e.target.value)} placeholder="First" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Last name (optional)</label>
                    <input className="border rounded px-3 py-2 w-full" value={guestLast} onChange={(e) => setGuestLast(e.target.value)} placeholder="Last" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm mb-1">Phone (optional)</label>
                    <input className="border rounded px-3 py-2 w-full" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="(555) 555-5555" />
                  </div>
                  <div className="sm:col-span-2 text-xs text-muted-foreground">Already have an account? <a href="/auth/login" className="underline">Sign in</a> to auto-link and view in your portal.</div>
                </div>
              ) : (
                <div className="text-sm">We will use your account profile.</div>
              )}
            </div>
            <div>
              <label className="block text-sm mb-1">Notes</label>
              <textarea className="border rounded px-3 py-2 w-full" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button onClick={submit} className="underline">Request appointment</button>
            {message && <div className="text-sm mt-2">{message}</div>}
            {/* Payment UI for immediate capture */}
            {appointmentId && amountCents > 0 && (
              <DynamicBookingPayment amountCents={amountCents} appointmentId={appointmentId ?? undefined} />
            )}
          </div>
        )}
      </div>
    </Suspense>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-4 py-8">Loading…</div>}>
      <BookingClient />
    </Suspense>
  );
}

const DynamicBookingPayment = dynamic(() => import("./payment-client"), { ssr: false });


