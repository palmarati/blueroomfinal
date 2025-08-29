import { createClient } from "@/lib/supabase/server";

export default async function PortalModules() {
  const supabase = await createClient();
  const { data: modules } = await supabase
    .from("modules")
    .select("id,title,slug,description,visible")
    .eq("visible", true)
    .order("title");
  return (
    <div className="space-y-3">
      {(modules ?? []).map((m) => (
        <div key={m.id} className="border rounded p-3">
          <div className="font-medium">{m.title}</div>
          <div className="text-sm">{m.description}</div>
        </div>
      ))}
      {(!modules || modules.length === 0) && <div>No modules available.</div>}
    </div>
  );
}


