import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("business_settings")
    .select("id,business_name,phone,email,timezone,booking_increment_min,min_start_lead_min,max_booking_horizon_days")
    .limit(1)
    .maybeSingle();

  async function save(formData: FormData) {
    "use server";
    const id = String(formData.get("id"));
    const supa = await createClient();
    const payload = {
      business_name: String(formData.get("business_name") || ""),
      phone: String(formData.get("phone") || ""),
      email: String(formData.get("email") || ""),
      timezone: String(formData.get("timezone") || "America/Los_Angeles"),
      booking_increment_min: Number(formData.get("booking_increment_min") || 15),
      min_start_lead_min: Number(formData.get("min_start_lead_min") || 60),
      max_booking_horizon_days: Number(formData.get("max_booking_horizon_days") || 60),
    };
    if (id) {
      await supa.from("business_settings").update(payload).eq("id", id);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Business Settings</h1>
      {settings ? (
        <form action={save} className="grid md:grid-cols-2 gap-3 max-w-3xl">
          <input type="hidden" name="id" value={settings.id} />
          <div>
            <label className="block text-xs mb-1">Business name</label>
            <input name="business_name" defaultValue={settings.business_name ?? ""} className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-xs mb-1">Phone</label>
            <input name="phone" defaultValue={settings.phone ?? ""} className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-xs mb-1">Email</label>
            <input name="email" defaultValue={settings.email ?? ""} className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-xs mb-1">Timezone</label>
            <input name="timezone" defaultValue={settings.timezone ?? "America/Los_Angeles"} className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-xs mb-1">Booking increment (min)</label>
            <input type="number" name="booking_increment_min" defaultValue={settings.booking_increment_min ?? 15} className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-xs mb-1">Minimum lead (min)</label>
            <input type="number" name="min_start_lead_min" defaultValue={settings.min_start_lead_min ?? 60} className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-xs mb-1">Max horizon (days)</label>
            <input type="number" name="max_booking_horizon_days" defaultValue={settings.max_booking_horizon_days ?? 60} className="border rounded px-2 py-1 w-full" />
          </div>
          <div className="col-span-full mt-2">
            <button className="underline" type="submit">Save</button>
          </div>
        </form>
      ) : (
        <div>No settings row found.</div>
      )}
    </div>
  );
}


