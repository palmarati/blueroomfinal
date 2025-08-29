import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ServicesPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("service_categories")
    .select("id,name,slug")
    .eq("visible", true)
    .order("sort_order");
  const { data: services } = await supabase
    .from("services")
    .select("id,name,slug,description,base_price_cents,base_duration_min,category_id")
    .eq("visible", true)
    .eq("draft", false)
    .order("name");

  const categoryMap = new Map((categories ?? []).map((c) => [c.id, c]));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-4">Services</h1>
      <div className="grid gap-4">
        {(services ?? []).map((s) => (
          <div key={s.id} className="border rounded p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{s.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {categoryMap.get(s.category_id)?.name ?? "Uncategorized"}
                </p>
              </div>
              <div className="text-right">
                <div>${((s.base_price_cents ?? 0) / 100).toFixed(2)}</div>
                <div className="text-xs">{s.base_duration_min} min</div>
              </div>
            </div>
            {s.description && (
              <p className="mt-2 text-sm">{s.description}</p>
            )}
            <div className="mt-3">
              <Link
                href={`/booking?service=${encodeURIComponent(s.id)}`}
                className="underline"
              >
                Book this service
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


