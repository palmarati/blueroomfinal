"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function CreateUserPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.push("/auth/login");
        return;
      }
      const user = session.session.user;
      const email = user.email;
      // Try to find existing client by user_id first
      const { data: clientByUser } = await supabase.from("clients").select("id").eq("user_id", user.id).maybeSingle();
      if (clientByUser?.id) {
        router.push("/portal");
        return;
      }
      // If email exists, attach; else insert new
      const { data: byEmail } = await supabase.from("clients").select("id").eq("email", email).maybeSingle();
      if (byEmail?.id) {
        const { error: updErr } = await supabase.from("clients").update({ user_id: user.id, first_name: firstName || null, last_name: lastName || null, phone: phone || null }).eq("id", byEmail.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase.from("clients").insert({ user_id: user.id, email, first_name: firstName || null, last_name: lastName || null, phone: phone || null });
        if (insErr) throw insErr;
      }
      router.push("/portal");
    } catch (err: any) {
      setError(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-4">Complete your profile</h1>
      <p className="text-sm mb-4">Add your name and phone to finish setting up your account.</p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">First name</label>
          <input className="border rounded px-3 py-2 w-full" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Last name</label>
          <input className="border rounded px-3 py-2 w-full" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Phone</label>
          <input className="border rounded px-3 py-2 w-full" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
        </div>
        {error && <div className="text-sm text-red-500">{error}</div>}
        <button type="submit" disabled={saving} className="underline">
          {saving ? "Saving..." : "Save and continue"}
        </button>
      </form>
    </div>
  );
}


