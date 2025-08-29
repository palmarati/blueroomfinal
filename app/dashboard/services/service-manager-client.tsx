"use client";

import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";

type Category = { id: string; name: string };
type Service = {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  visible: boolean;
  draft: boolean;
  base_price_cents: number;
  base_duration_min: number;
  deposit_cents?: number | null;
  image_url?: string | null;
  color?: string | null;
};

type ServiceWithMeta = Service & { optionsCount: number; categoryName?: string };

export default function ServiceManagerClient({
  categories,
  services,
  onCreate,
  onUpdate,
  onDelete,
}: {
  categories: Category[];
  services: ServiceWithMeta[];
  onCreate: (formData: FormData) => Promise<void>;
  onUpdate: (formData: FormData) => Promise<void>;
  onDelete: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [editService, setEditService] = useState<ServiceWithMeta | null>(null);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  return (
    <div className="space-y-4">
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditService(null); }}>
        <div className="flex justify-between items-center">
          <h2 className="font-semibold">Services</h2>
          <DialogTrigger asChild>
            <button className="underline" onClick={() => { setEditService(null); setOpen(true); }}>Add service</button>
          </DialogTrigger>
        </div>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editService ? "Edit service" : "Add service"}</DialogTitle>
          </DialogHeader>
          <ServiceForm
            categories={categories}
            service={editService ?? undefined}
            actionFn={editService ? onUpdate : onCreate}
            onDone={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <div className="grid gap-3">
        {services.map((s) => (
          <div key={s.id} className="border rounded p-3 flex items-start gap-3">
            <div className="w-20 h-20 bg-muted rounded overflow-hidden flex items-center justify-center" style={{ background: s.color || undefined }}>
              {s.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image_url} alt={s.name} className="object-cover w-full h-full" />
              ) : (
                <div className="text-xs text-muted-foreground">No image</div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{s.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded border">{s.visible && !s.draft ? "Live" : "Not live"}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {s.optionsCount > 0 ? `${s.optionsCount} option${s.optionsCount > 1 ? "s" : ""}` : null}
                {s.optionsCount > 0 ? " · " : ""}
                {s.base_duration_min > 0 && s.optionsCount === 0 ? `${s.base_duration_min} min` : null}
                {(s.base_duration_min > 0 && s.optionsCount === 0) ? " · " : ""}
                {s.category_id ? categoryMap.get(s.category_id) : "Uncategorized"}
                {" · "}
                {s.deposit_cents && s.deposit_cents > 0 ? `Deposit $${(s.deposit_cents/100).toFixed(2)}` : "No deposit"}
                {s.optionsCount === 0 ? ` · $${((s.base_price_cents ?? 0)/100).toFixed(2)}` : ""}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="underline"
                onClick={() => { setEditService(s); setOpen(true); }}
                aria-label="Edit"
              >Edit</button>
              <form action={onDelete}>
                <input type="hidden" name="id" value={s.id} />
                <button className="underline text-red-600" aria-label="Delete">Delete</button>
              </form>
            </div>
          </div>
        ))}
        {services.length === 0 && <div className="text-sm text-muted-foreground">No services yet.</div>}
      </div>
    </div>
  );
}

function ServiceForm({ categories, service, actionFn, onDone }: { categories: Category[]; service?: ServiceWithMeta; actionFn: (fd: FormData) => Promise<void>; onDone: () => void }) {
  const [useDeposit, setUseDeposit] = useState<boolean>(!!(service?.deposit_cents && service.deposit_cents > 0));
  const [hasOptions, setHasOptions] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState<string>(service?.image_url ?? "");
  const supabase = useMemo(() => createClient(), []);
  const colorInputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={async (fd) => { await actionFn(fd); onDone(); }} className="space-y-3">
      {service?.id && <input type="hidden" name="id" value={service.id} />}
      <div className="grid md:grid-cols-2 gap-2">
        <div>
          <label className="block text-xs mb-1">Name</label>
          <input name="name" defaultValue={service?.name ?? ""} className="border rounded px-2 py-1 w-full" required />
        </div>
        <div>
          <label className="block text-xs mb-1">Category</label>
          <select name="category_id" defaultValue={service?.category_id ?? ""} className="border rounded px-2 py-1 w-full">
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1">Image</label>
          <div className="flex items-center gap-2">
            <input type="file" accept="image/*" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              try {
                const filename = `${Date.now()}-${file.name}`.replace(/\s+/g, "-");
                const { error } = await supabase.storage.from("services").upload(filename, file, { upsert: true, cacheControl: "3600" });
                if (error) throw error;
                const { data: pub } = supabase.storage.from("services").getPublicUrl(filename);
                setImageUrl(pub.publicUrl);
              } catch (err) {
                console.error(err);
                alert("Upload failed. Check your Supabase Storage bucket named 'services' is public.");
              } finally {
                setUploading(false);
              }
            }} />
            {uploading && <span className="text-xs">Uploading…</span>}
          </div>
          <input type="hidden" name="image_url" value={imageUrl} />
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="preview" className="mt-2 w-24 h-24 object-cover rounded border" />
          )}
        </div>
        <div>
          <label className="block text-xs mb-1">Color</label>
          <div className="flex items-center gap-2">
            <input ref={colorInputRef} type="color" defaultValue={service?.color ?? "#7aa8ff"} onChange={(e) => { /* keep hidden input synced */ const hidden = (e.target.form as HTMLFormElement)?.querySelector<HTMLInputElement>('input[name="color"]'); if (hidden) hidden.value = e.target.value; }} />
            <input type="hidden" name="color" defaultValue={service?.color ?? "#7aa8ff"} />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs mb-1">Description</label>
        <textarea name="description" defaultValue={service?.description ?? ""} className="border rounded px-2 py-1 w-full" />
      </div>
      <div className="grid md:grid-cols-3 gap-2 items-end">
        <div hidden={hasOptions}>
          <label className="block text-xs mb-1">Price ($)</label>
          <input name="base_price_dollars" type="number" step="0.01" defaultValue={service ? ((service.base_price_cents ?? 0)/100).toFixed(2) : "0.00"} className="border rounded px-2 py-1 w-full" />
        </div>
        <div hidden={hasOptions}>
          <label className="block text-xs mb-1">Duration (min)</label>
          <input name="base_duration_min" type="number" defaultValue={service?.base_duration_min ?? 0} className="border rounded px-2 py-1 w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={useDeposit} onCheckedChange={setUseDeposit} id="deposit-switch" />
          <label htmlFor="deposit-switch" className="text-sm">Require deposit</label>
        </div>
        <div hidden={!useDeposit}>
          <label className="block text-xs mb-1">Deposit ($)</label>
          <input name="deposit_dollars" type="number" step="0.01" defaultValue={service ? ((service.deposit_cents ?? 0)/100).toFixed(2) : "0.00"} className="border rounded px-2 py-1 w-full" />
        </div>
        <div>
          <label className="block text-xs mb-1">Block time after (min)</label>
          <input name="processing_time_min" type="number" defaultValue={0} className="border rounded px-2 py-1 w-full" />
        </div>
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" name="visible" defaultChecked={service ? !!service.visible : true} /> Show on website</label>
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" name="draft" defaultChecked={service ? !!service.draft : false} /> Draft</label>
        </div>
      </div>

      <div className="border rounded p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">Options</h4>
          <button type="button" className="underline text-sm" onClick={() => {
            const list = document.querySelectorAll(".svc-opt");
            if (list.length >= 10) return;
            const container = document.getElementById("options-container");
            if (!container) return;
            const idx = list.length;
            const row = document.createElement("div");
            row.className = "svc-opt grid md:grid-cols-5 gap-2";
            row.innerHTML = `
              <input name="option_name[]" placeholder="Option name" class="border rounded px-2 py-1" />
              <input name="option_price_dollars[]" type="number" step="0.01" placeholder="0.00" class="border rounded px-2 py-1" />
              <input name="option_duration_min[]" type="number" placeholder="60" class="border rounded px-2 py-1" />
              <input name="option_processing_min[]" type="number" placeholder="0" class="border rounded px-2 py-1" />
              <input name="option_deposit_dollars[]" type="number" step="0.01" placeholder="Deposit (optional)" class="border rounded px-2 py-1" />
            `;
            container.appendChild(row);
            setHasOptions(true);
          }}>Add option</button>
        </div>
        <div id="options-container" className="space-y-2" />
        <div className="text-xs text-muted-foreground">If at least one option is added, the base price and duration are ignored.</div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="submit" className="underline">Save and publish service</button>
      </div>
    </form>
  );
}


