import { createClient } from "@/lib/supabase/server";

export default async function ContactPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("business_settings")
    .select("business_name, phone, email, address")
    .limit(1)
    .maybeSingle();
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-4">Contact</h1>
      <div className="space-y-2">
        <div>{settings?.business_name}</div>
        <div>{settings?.phone}</div>
        <div>{settings?.email}</div>
        <pre className="bg-muted p-2 rounded text-sm">{JSON.stringify(settings?.address, null, 2)}</pre>
      </div>
    </div>
  );
}


