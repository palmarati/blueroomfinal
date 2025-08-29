#!/usr/bin/env node
/*
  Generate supabase/seed.sql from provided context files:
  - context/services.md (authoritative for services + options + addons)
  - context/clients_export_2025-08-26.csv (clients)
  - context/RETAIL_ The Room Spa - Sheet1.csv (products)

  Notes:
  - Salon Appointments CSV is NOT used to create services; only services.md is authoritative.
  - Currency stored in cents.
*/

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const ctxDir = path.join(ROOT, 'context');
const outFile = path.join(ROOT, 'supabase', 'seed.sql');

const SERVICES_MD = path.join(ctxDir, 'services.md');
const CLIENTS_CSV = path.join(ctxDir, 'clients_export_2025-08-26.csv');
const PRODUCTS_CSV = path.join(ctxDir, 'RETAIL_ The Room Spa - Sheet1.csv');
const APPOINTMENTS_CSV = path.join(ctxDir, 'Salon Appointments-2025-08-25.csv');
const LINE_ITEMS_CSV = path.join(ctxDir, 'Checkout Line Items-2025-08-27.csv');

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function priceToCents(value) {
  if (value == null || value === '') return 0;
  const num = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.\-]/g, ''));
  if (!isFinite(num)) return 0;
  return Math.round(num * 100);
}

function readFileIfExists(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    return '';
  }
}

function parseCSV(text) {
  // Simple CSV parser tolerant of commas in quotes
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = splitCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCSVLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (cells[i] ?? '').trim();
    });
    return row;
  });
}

function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

function escapeLiteral(str) {
  return String(str ?? '').replace(/'/g, "''");
}

function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return [null, null];
  if (parts.length === 1) return [parts[0], null];
  return [parts[0], parts.slice(1).join(' ')];
}

function toPTISO(mmddyyCommaTime) {
  // Input example: "06-19-23, 10:30 AM"
  if (!mmddyyCommaTime) return null;
  const m = /(\d{2})-(\d{2})-(\d{2}),\s*(\d{1,2}):(\d{2})\s*([AP]M)/i.exec(mmddyyCommaTime);
  if (!m) return null;
  let [_, mm, dd, yy, hh, min, ap] = m;
  const year = 2000 + Number(yy);
  let hour = Number(hh);
  const minute = Number(min);
  const isPM = ap.toUpperCase() === 'PM';
  if (isPM && hour !== 12) hour += 12;
  if (!isPM && hour === 12) hour = 0;
  const month = Number(mm);
  const day = Number(dd);
  const pad = (n) => String(n).padStart(2, '0');
  // Use PT offset approximation (-07:00). For historical seeding this is acceptable.
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00-07:00`;
}

function addMinutesISO(iso, minutes) {
  if (!iso) return null;
  const m = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-]\d{2}:\d{2})/.exec(iso);
  if (!m) return iso;
  const [_, y, mo, d, h, mi, s, off] = m;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${off}`);
  date.setMinutes(date.getMinutes() + (minutes || 0));
  const pad = (n) => String(n).padStart(2, '0');
  const y2 = date.getUTCFullYear();
  const mo2 = pad(date.getUTCMonth() + 1);
  const d2 = pad(date.getUTCDate());
  const h2 = pad(date.getUTCHours());
  const mi2 = pad(date.getUTCMinutes());
  const s2 = pad(date.getUTCSeconds());
  // Keep same PT offset for simplicity
  return `${y2}-${mo2}-${d2}T${h2}:${mi2}:${s2}-07:00`;
}

function normalizeServiceName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D+/g, '');
  if (!digits) return null;
  // If 10 digits, assume US and format E164-like without plus
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return digits;
  return digits;
}

function normalizeNameKey(fullName) {
  return String(fullName || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeFullNameKey(firstName, lastName) {
  const first = String(firstName || '').trim();
  const last = String(lastName || '').trim();
  return normalizeNameKey((first + ' ' + last).trim());
}

function matchService(inputName, svcCatalog) {
  const norm = normalizeServiceName(inputName);
  if (!norm) return null;
  // direct contains mapping
  const aliases = [
    { test: /classic\s+buccal|buccal\s+facial|buccal\s+session/, target: 'the-classic-buccal' },
    { test: /cult\s+classic/, target: 'the-cult-classic-buccal-facial' },
    { test: /teen\s+facial|teen\s+facials/, target: 'teen-facials' },
    { test: /ultra\s+luxe|premium\s+facial/, target: 'the-ultra-luxe-premium-facial' },
    { test: /express\s+release|express\s+treat/, target: 'express-treatments' },
    { test: /sculpt/, target: 'the-classic-sculpt' },
    { test: /men\b|mens\b/, target: 'men-s-facials' }
  ];
  for (const a of aliases) {
    if (a.test.test(norm)) {
      const found = svcCatalog.find((s) => s.slug === a.target);
      if (found) return found;
    }
  }
  // fallback: best includes by name similarity
  let best = null;
  let bestScore = 0;
  for (const s of svcCatalog) {
    const nm = normalizeServiceName(s.name);
    let score = 0;
    if (norm === nm) score = 100;
    else if (nm.includes(norm)) score = norm.length;
    else if (norm.includes(nm)) score = nm.length;
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return best;
}

function clientIdSelect(firstName, lastName) {
  const fn = firstName ? firstName.toLowerCase() : null;
  const ln = lastName ? lastName.toLowerCase() : null;
  if (fn && ln) {
    return `(select id from public.clients where lower(first_name)='${escapeLiteral(fn)}' and lower(last_name)='${escapeLiteral(ln)}' limit 1)`;
  }
  if (fn) {
    return `(select id from public.clients where lower(first_name)='${escapeLiteral(fn)}' limit 1)`;
  }
  return 'NULL';
}

function mapAppointmentStatus(statusRaw) {
  const s = String(statusRaw || '').toLowerCase();
  if (s.includes('completed')) return 'completed';
  if (s.includes('declined')) return 'denied';
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('no show')) return 'no_show';
  if (s.includes('approve')) return 'approved';
  if (s.includes('request')) return 'requested';
  return 'requested';
}

function mapPaymentStatus(statusRaw, hasCharge) {
  const s = String(statusRaw || '').toLowerCase();
  if (hasCharge && s.includes('completed')) return 'captured';
  if (s.includes('declined')) return 'failed';
  return hasCharge ? 'captured' : 'none';
}

function sqlInsert(table, columns, rows) {
  if (!rows.length) return '';
  const cols = columns.map((c) => '"' + c + '"').join(', ');
  const values = rows
    .map((r) =>
      '(' +
      columns
        .map((c) => {
          const v = r[c];
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number') return String(v);
          if (v === true) return 'true';
          if (v === false) return 'false';
          return "'" + escapeLiteral(String(v)) + "'";
        })
        .join(', ') +
      ')'
    )
    .join(',\n');
  return `insert into ${table} (${cols}) values\n${values};\n\n`;
}

function parseServicesMarkdown(md) {
  // Minimal parser tailored to provided format
  const lines = md.split(/\r?\n/);
  const services = [];
  const addons = [];

  let i = 0;
  let currentService = null;
  let inAddons = false;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (/^##\s+Add-On Services/i.test(line)) {
      // push any pending service before switching section
      if (currentService) {
        services.push(currentService);
        currentService = null;
      }
      inAddons = true;
      i++;
      continue;
    }

    // Services section numbered entries like "1. The Ultra-Luxe..."
    const svcMatch = /^\d+\.\s*(.+)$/.exec(line);
    if (!inAddons && svcMatch) {
      if (currentService) services.push(currentService);
      currentService = {
        name: svcMatch[1].trim(),
        description: null,
        base_duration_min: 0,
        base_price_cents: 0,
        base_deposit_cents: 0,
        category: null,
        processing_time_min: 0,
        buffer_after_min: 0,
        existing_clients_only: false,
        variants: []
      };
      i++;
      continue;
    }

    if (!inAddons && currentService) {
      const durationM = /^Duration:\s*(\d+)\s*minutes/i.exec(line);
      if (durationM) currentService.base_duration_min = Number(durationM[1]);
      const priceM = /^Base Price:\s*\$?([0-9,.]+)/i.exec(line);
      if (priceM) currentService.base_price_cents = priceToCents(priceM[1]);
      const depositM = /Base Deposit:\s*\$?([0-9,.]+)/i.exec(line);
      if (depositM) currentService.base_deposit_cents = priceToCents(depositM[1]);
      const catM = /^Category:\s*(.+)$/i.exec(line);
      if (catM) currentService.category = catM[1].trim();
      const procM = /^Processing Time:\s*(\d+)\s*minutes/i.exec(line);
      if (procM) currentService.processing_time_min = Number(procM[1]);
      const blkM = /Block Time After:\s*(\d+)\s*minutes/i.exec(line);
      if (blkM) currentService.buffer_after_min = Number(blkM[1]);
      const existM = /Existing Clients Only:\s*(.+)$/i.exec(line);
      if (existM) currentService.existing_clients_only = /yes/i.test(existM[1]);
      const variantM = /^(.+?):\s*(\d+)\s*min\s*\|\s*\$?([0-9,.]+)\s*\|\s*\$?([0-9,.]+)\s*deposit/i.exec(line);
      if (variantM) {
        currentService.variants.push({
          name: variantM[1].trim(),
          duration_min: Number(variantM[2]),
          price_cents: priceToCents(variantM[3]),
          deposit_cents: priceToCents(variantM[4])
        });
      }

      // Handle entries where fields are labeled Price/Deposit instead of Base
      const priceAltM = /^Price:\s*\$?([0-9,.]+)/i.exec(line);
      if (priceAltM) currentService.base_price_cents = priceToCents(priceAltM[1]);
      const depositAltM = /Deposit:\s*\$?([0-9,.]+)/i.exec(line);
      if (depositAltM) currentService.base_deposit_cents = priceToCents(depositAltM[1]);

      // End of current service when encountering blank line followed by new index or section
    }

    if (inAddons) {
      // Add-on formats
      // e.g., "8. CO2Lift Pro Treatment" then Duration/Price/Deposit/Category/Color
      const addonTitleM = /^\d+\.\s*(.+)$/.exec(line);
      if (addonTitleM) {
        const name = addonTitleM[1].trim();
        // Collect following lines until next numbered or end
        let j = i + 1;
        let durationMin = 0;
        let priceCents = 0;
        let color = null;
        let variants = [];
        while (j < lines.length) {
          const ln = lines[j].trim();
          if (/^\d+\./.test(ln) || /^##\s/.test(ln)) break;
          const dM = /^Duration:\s*(\d+)\s*minutes/i.exec(ln);
          if (dM) durationMin = Number(dM[1]);
          const pM = /^Price:\s*\$?([0-9,.]+)/i.exec(ln);
          if (pM) priceCents = priceToCents(pM[1]);
          const colorM = /^Color:\s*(.+)$/i.exec(ln);
          if (colorM) color = colorM[1].trim();
          // Variant format: "Scalp Treatment - 10 min: $25.00 | $15.00 deposit"
          const varM = /^(.+?)\s*-\s*(\d+)\s*min:\s*\$?([0-9,.]+)\s*\|\s*\$?([0-9,.]+)\s*deposit/i.exec(ln);
          if (varM) {
            variants.push({
              name: varM[1].trim(),
              duration_min: Number(varM[2]),
              price_cents: priceToCents(varM[3]),
              deposit_cents: priceToCents(varM[4])
            });
          }
          j++;
        }
        addons.push({ name, duration_min: durationMin, price_cents: priceCents, color, variants });
      }
    }

    i++;
  }

  if (currentService) services.push(currentService);
  return { services, addons };
}

function buildSQL() {
  const chunks = [];
  chunks.push('-- Generated by scripts/generate-seed.js\n');
  chunks.push('begin;\n');
  // Track known client names from clients CSV for safe linkage
  const knownClientNames = new Set();

  // Seed business_settings sensible defaults if empty
  chunks.push(`insert into public.business_settings (id, business_name, timezone)\nselect gen_random_uuid(), 'Blue Room Spa', 'America/Los_Angeles'\nwhere not exists (select 1 from public.business_settings);\n\n`);

  // Update constants from old project defaults
  // - timezone: America/Los_Angeles
  // - booking_increment_min: 15 (slot_duration_minutes)
  // - min_start_lead_min: 120 (min_advance_hours: 2)
  // - max_booking_horizon_days: 60 (max_advance_months: 2)
  // - contact and address
  chunks.push(`update public.business_settings set 
  business_name = 'The Blue Room Spa',
  timezone = 'America/Los_Angeles',
  booking_increment_min = 15,
  min_start_lead_min = 120,
  max_booking_horizon_days = 60,
  cancellation_window_hours = 24,
  reschedule_limit = 2,
  payments_mode = 'capture',
  tax_rate_pct = 0,
  phone = '+1 (971) 555-1234',
  email = 'info@blueroomspa.com',
  address = jsonb_build_object('raw','1915 NW Kearney St, Portland, OR 97209')
where true;\n\n`);

  // Seed business_hours: Wed–Sat 10:00–17:00, Sun 11:00–16:00, Mon/Tue closed
  // weekday: 0=Sunday, 1=Monday, ... 6=Saturday
  chunks.push(`insert into public.business_hours (weekday, open_time, close_time, is_closed)
select * from (values
  (0, '11:00'::time, '16:00'::time, false),
  (1, null::time, null::time, true),
  (2, null::time, null::time, true),
  (3, '10:00'::time, '17:00'::time, false),
  (4, '10:00'::time, '17:00'::time, false),
  (5, '10:00'::time, '17:00'::time, false),
  (6, '10:00'::time, '17:00'::time, false)
) as v(weekday, open_time, close_time, is_closed)
where not exists (select 1 from public.business_hours);\n\n`);

  // SERVICES
  const servicesMd = readFileIfExists(SERVICES_MD);
  let parsedServices = { services: [], addons: [] };
  if (servicesMd) {
    parsedServices = parseServicesMarkdown(servicesMd);
    const { services, addons } = parsedServices;

    // Categories
    const categoryNames = Array.from(new Set(services.map((s) => s.category).filter(Boolean)));
    const categoriesRows = categoryNames.map((name, idx) => ({
      id: null,
      name,
      slug: slugify(name),
      description: null,
      sort_order: idx,
      visible: true
    }));
    chunks.push(sqlInsert('public.product_categories', ['name','slug','description','sort_order','created_at','updated_at'], [])); // noop placeholder
    chunks.push(sqlInsert('public.service_categories', ['name','slug','description','sort_order','visible'], categoriesRows));

    // Services
    const serviceRows = services.map((s) => ({
      name: s.name,
      slug: slugify(s.name),
      description: null,
      base_price_cents: s.base_price_cents,
      base_duration_min: s.base_duration_min,
      buffer_before_min: 0,
      buffer_after_min: s.buffer_after_min || 0,
      visible: true,
      draft: false,
      existing_clients_only: !!s.existing_clients_only,
      processing_time_min: s.processing_time_min || 0
    }));
    chunks.push(sqlInsert('public.services', [
      'name','slug','description','base_price_cents','base_duration_min','buffer_before_min','buffer_after_min','visible','draft','existing_clients_only','processing_time_min'
    ], serviceRows));

    // Link categories to services by update statements
    services.forEach((s) => {
      if (!s.category) return;
      const svcSlug = slugify(s.name);
      const catSlug = slugify(s.category);
      chunks.push(`update public.services set category_id = (select id from public.service_categories where slug='${escapeLiteral(catSlug)}') where slug='${escapeLiteral(svcSlug)}';\n`);
    });

    // Service options: store as deltas from base
    const optionRows = [];
    services.forEach((s) => {
      const baseDur = s.base_duration_min || 0;
      const basePrice = s.base_price_cents || 0;
      (s.variants || []).forEach((v, idx) => {
        optionRows.push({
          service_id: `(select id from public.services where slug='${slugify(s.name)}')`,
          name: v.name,
          price_delta_cents: v.price_cents - basePrice,
          duration_delta_min: v.duration_min - baseDur,
          sort_order: idx,
          visible: true
        });
      });
    });
    // Render options with inline subselects
    if (optionRows.length) {
      const cols = ['service_id','name','price_delta_cents','duration_delta_min','sort_order','visible'];
      const values = optionRows.map((r) => `((select id from public.services where slug='${escapeLiteral(r.service_id.match(/slug='([^']+)'/)[1])}'), '${escapeLiteral(r.name)}', ${r.price_delta_cents}, ${r.duration_delta_min}, ${r.sort_order}, ${r.visible ? 'true':'false'})`).join(',\n');
      chunks.push(`insert into public.service_options ("${cols.join('\", \"')}") values\n${values};\n\n`);
    }

    // Addons (global) and service links will be curated manually; here we only seed addons
    const addonRows = addons.map((a) => ({
      name: a.name,
      slug: slugify(a.name),
      description: null,
      price_delta_cents: a.price_cents || 0,
      duration_delta_min: a.duration_min || 0,
      color: a.color || null,
      visible: true
    }));
    chunks.push(sqlInsert('public.addons', ['name','slug','description','price_delta_cents','duration_delta_min','color','visible'], addonRows));
  }

  // CLIENTS
  const clientsCsv = readFileIfExists(CLIENTS_CSV);
  if (clientsCsv) {
    const rows = parseCSV(clientsCsv);
    const clients = [];
    const seen = new Set();
    for (const r of rows) {
      const email = r['Email'] || r['email'] || r['Client Email'] || '';
      const fullName = r['Name'] || r['Full Name'] || r['Client Name'] || '';
      const [first, ...rest] = fullName.split(' ').filter(Boolean);
      const last = rest.join(' ');
      const phone = normalizePhone(r['Phone'] || r['phone'] || r['Client Phone'] || '');
      if (!email && !first && !phone) continue;
      const key = (email ? email.toLowerCase() : '') + '|' + (phone || '');
      if (key.trim() && seen.has(key)) continue;
      if (key.trim()) seen.add(key);
      clients.push({
        email: email || null,
        first_name: first || null,
        last_name: last || null,
        phone: phone || null,
        notes: null
      });
      const nameKey = normalizeFullNameKey(first, last);
      if (nameKey) knownClientNames.add(nameKey);
    }
    chunks.push(sqlInsert('public.clients', ['email','first_name','last_name','phone','notes'], clients));
  }

  // PRODUCTS
  const productsCsv = readFileIfExists(PRODUCTS_CSV);
  if (productsCsv) {
    const rows = parseCSV(productsCsv);
    const products = [];
    const categories = new Set();
    const seenSlugs = new Set();
    for (const r of rows) {
      // messy headers: Promotion,Brand,Product Name,Size,Retail Price,Quantity On Hand,Avail In-House,Available Thru Affiliate,Category, ...
      const name = (r['Product Name'] || r['Product'] || r['Name'] || '').trim();
      if (!name) continue;
      const brand = (r['Brand'] || '').trim() || null;
      const price = priceToCents(r['Retail Price'] || r['Price'] || '');
      // Determine in_house and affiliate
      const inHouse = /^y/i.test(String(r['Avail In-House'] || r['In House'] || '').trim());
      const affiliate = /^y/i.test(String(r['Available Thru Affiliate'] || r['Affiliate'] || '').trim());
      const affiliateUrl = affiliate ? (r['Affiliate Link'] || r['affiliate_url'] || null) : null;
      // Category may be in one of multiple columns; join non-empty
      const catParts = [r['Category'], r[''], r['  '], r['   ']].filter((v) => v && String(v).trim());
      const category = catParts.length ? String(catParts[0]).trim() : null;
      if (category) categories.add(category);
      const slug = slugify(`${brand ? brand + ' ' : ''}${name}`);
      if (!slug || seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);

      products.push({
        name: name,
        slug,
        description: null,
        brand: brand,
        image_url: null,
        price_cents: price,
        compare_at_price_cents: null,
        affiliate_url: affiliateUrl,
        in_house: inHouse,
        visible: true
      });
    }

    if (products.length) {
      chunks.push(sqlInsert('public.products', [
        'name','slug','description','brand','image_url','price_cents','compare_at_price_cents','affiliate_url','in_house','visible'
      ], products));
    }

    if (categories.size) {
      const catRows = Array.from(categories).map((name, idx) => ({
        name,
        slug: slugify(name),
        description: null,
        sort_order: idx
      }));
      chunks.push(sqlInsert('public.product_categories', ['name','slug','description','sort_order'], catRows));
      // Links
      rows.forEach((r) => {
        const pname = (r['Product Name'] || r['Product'] || r['Name'] || '').trim();
        if (!pname) return;
        const brand = (r['Brand'] || '').trim();
        const pslug = slugify(`${brand ? brand + ' ' : ''}${pname}`);
        const catParts = [r['Category'], r[''], r['  '], r['   ']].filter((v) => v && String(v).trim());
        const category = catParts.length ? String(catParts[0]).trim() : null;
        if (!category) return;
        const cslug = slugify(category);
        chunks.push(`insert into public.product_category_links (product_id, category_id)\nvalues ((select id from public.products where slug='${escapeLiteral(pslug)}'), (select id from public.product_categories where slug='${escapeLiteral(cslug)}'))\nON CONFLICT DO NOTHING;\n`);
      });
    }
  }

  // CHECKOUT LINE ITEMS → payments + orders + order_items (best-effort)
  const lineItemsCsv = readFileIfExists(LINE_ITEMS_CSV);
  if (lineItemsCsv) {
    const rows = parseCSV(lineItemsCsv);
    // Group by Charge ID
    const byCharge = new Map();
    for (const r of rows) {
      const charge = (r['Charge ID'] || '').trim();
      if (!charge) continue;
      if (!byCharge.has(charge)) byCharge.set(charge, []);
      byCharge.get(charge).push(r);
    }

    const payments = [];
    const orders = [];
    const orderItems = [];

    for (const [charge, items] of byCharge.entries()) {
      // find client name
      const sample = items[0];
      const clientName = (sample['Client'] || '').trim();
      const [firstName, lastName] = splitName(clientName);
      // ensure client exists in our seeded clients; otherwise skip to avoid NULL FK later
      const clientKey = normalizeFullNameKey(firstName, lastName);
      if (!clientKey || !knownClientNames.has(clientKey)) continue;
      // compute totals
      let totalCents = 0;
      let subtotalCents = 0;
      for (const it of items) {
        const price = priceToCents(it['Price']);
        const type = (it['Item Type'] || '').toLowerCase();
        if (type === 'discount') {
          totalCents += price; // price is negative in CSV
        } else {
          subtotalCents += Math.max(price, 0);
          totalCents += price;
        }
      }

      const dateStr = (sample['Date Succeeded'] || '').trim();
      const iso = toPTISO(dateStr);

      // payment (captured)
      payments.push({
        client_id_sql: clientIdSelect(firstName, lastName),
        amount_cents: totalCents,
        currency: 'USD',
        status: 'captured',
        square_payment_id: charge,
        source: 'order',
        source_id: null,
        created_at: iso
      });

      // order (paid if total >= 0 else refunded) with deterministic UUID from charge id
      const orderIdExpr = `uuid_generate_v5('6ba7b811-9dad-11d1-80b4-00c04fd430c8'::uuid, '${escapeLiteral(charge)}')`;
      orders.push({
        id_sql: orderIdExpr,
        client_id_sql: clientIdSelect(firstName, lastName),
        status: totalCents >= 0 ? 'paid' : 'refunded',
        subtotal_cents: Math.max(subtotalCents, 0),
        tax_cents: 0,
        shipping_cents: 0,
        total_cents: totalCents,
        pickup_in_store: false,
        affiliate: false,
        affiliate_url_snapshot: null,
        charge_id: charge
      });

      for (const it of items) {
        const name = it['Descriptor'] || it['Item'] || it['Item Name'] || 'Item';
        const price = priceToCents(it['Price']);
        const qty = 1;
        orderItems.push({
          order_id_sql: orderIdExpr,
          name_snapshot: name,
          unit_price_cents: price,
          quantity: qty,
          total_cents: price * qty
        });
      }
    }

    // Insert payments
    if (payments.length) {
      const cols = ['client_id','amount_cents','currency','status','square_payment_id','source','source_id','created_at'];
      const values = payments.map((p) => {
        const createdExpr = p.created_at ? `'${escapeLiteral(p.created_at)}'` : 'now()';
        return `(${p.client_id_sql}, ${p.amount_cents}, 'USD', '${p.status}', '${escapeLiteral(p.square_payment_id)}', 'order', NULL, ${createdExpr})`;
      }).join(',\n');
      chunks.push(`insert into public.payments ("${cols.join('\", \"')}") values\n${values};\n\n`);
    }

    // Insert orders with explicit id
    if (orders.length) {
      const rows = orders.map((o) => `(${o.id_sql}, ${o.client_id_sql}, '${o.status}', ${o.subtotal_cents}, 0, 0, ${o.total_cents}, ${o.pickup_in_store ? 'true':'false'}, ${o.affiliate ? 'true':'false'}, ${o.affiliate_url_snapshot ? `'${escapeLiteral(o.affiliate_url_snapshot)}'` : 'NULL'})`).join(',\n');
      chunks.push(`insert into public.orders ("id","client_id","status","subtotal_cents","tax_cents","shipping_cents","total_cents","pickup_in_store","affiliate","affiliate_url_snapshot") values\n${rows}\nON CONFLICT DO NOTHING;\n\n`);
    }

    // Insert order_items linked to orders, product_id left null
    if (orderItems.length) {
      const rows = orderItems.map((oi) => `(${oi.order_id_sql}, NULL, '${escapeLiteral(oi.name_snapshot)}', ${oi.unit_price_cents}, ${oi.quantity}, ${oi.total_cents})`).join(',\n');
      chunks.push(`insert into public.order_items ("order_id","product_id","name_snapshot","unit_price_cents","quantity","total_cents") values\n${rows};\n\n`);
    }

    // Optionally link orders to payments by matching charge id (square_payment_id)
    for (const o of orders) {
      const charge = o.charge_id;
      chunks.push(`update public.orders set payment_id = (select id from public.payments where square_payment_id='${escapeLiteral(charge)}' limit 1) where id = ${o.id_sql};\n`);
    }
    chunks.push(`\n`);
  }

  // SALON APPOINTMENTS → appointments (map to clients and services with fuzzy match)
  const apptsCsv = readFileIfExists(APPOINTMENTS_CSV);
  if (apptsCsv) {
    const rows = parseCSV(apptsCsv);
    const svcCatalog = (parsedServices.services || []).map((s) => ({
      name: s.name,
      slug: slugify(s.name),
      base_duration_min: s.base_duration_min || 60,
      buffer_after_min: s.buffer_after_min || 0,
      processing_time_min: s.processing_time_min || 0
    }));

    const inserts = [];
    for (const r of rows) {
      const when = (r['Date of Appointment'] || '').trim();
      const bookedAt = (r['Date Booked'] || '').trim();
      const serviceRaw = (r['Services'] || '').trim();
      const clientName = (r['Client Name'] || '').trim();
      const statusRaw = (r['Status'] || '').trim().toLowerCase();
      const chargeId = (r['Charge ID'] || '').trim();
      if (!when || !clientName || !serviceRaw) continue;

      const [firstName, lastName] = splitName(clientName);
      const clientKey = normalizeFullNameKey(firstName, lastName);
      if (!clientKey || !knownClientNames.has(clientKey)) continue;
      const svc = matchService(serviceRaw, svcCatalog);
      const svcSlug = svc ? svc.slug : null;
      if (!svcSlug) continue; // skip rows without a resolvable service
      const startISO = toPTISO(when);
      if (!startISO) continue; // skip rows with unparseable date
      const dur = (svc ? svc.base_duration_min : 60) + (svc ? svc.buffer_after_min : 0) + (svc ? svc.processing_time_min : 0);
      const endISO = addMinutesISO(startISO, dur);
      if (!endISO) continue;

      const status = mapAppointmentStatus(statusRaw);
      const paymentStatus = mapPaymentStatus(statusRaw, !!chargeId);

      inserts.push({
        client_id_sql: clientIdSelect(firstName, lastName),
        service_id_sql: svcSlug ? `(select id from public.services where slug='${escapeLiteral(svcSlug)}')` : 'NULL',
        start_at: startISO,
        end_at: endISO,
        status,
        payment_status: paymentStatus,
        notes: null,
        square_payment_id: chargeId || null
      });
    }

    if (inserts.length) {
      const cols = ['client_id','service_id','start_at','end_at','status','payment_status','notes','square_payment_id'];
      const values = inserts.map((a) => {
        const startExpr = a.start_at ? `'${escapeLiteral(a.start_at)}'` : 'NULL';
        const endExpr = a.end_at ? `'${escapeLiteral(a.end_at)}'` : 'NULL';
        const payExpr = a.square_payment_id ? `'${escapeLiteral(a.square_payment_id)}'` : 'NULL';
        return `(${a.client_id_sql}, ${a.service_id_sql}, ${startExpr}, ${endExpr}, '${a.status}', '${a.payment_status}', NULL, ${payExpr})`;
      }).join(',\n');
      chunks.push(`insert into public.appointments ("${cols.join('\", \"')}") values\n${values};\n\n`);
    }
  }

  chunks.push('commit;\n');
  return chunks.join('');
}

function main() {
  const sql = buildSQL();
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, sql, 'utf8');
  console.log(`Wrote ${outFile}`);
}

main();


