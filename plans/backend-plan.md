## Blue Room Spa OS — Backend Plan (MVP)

Version: 0.9 (Draft)
Date: 2025-08-28
Scope: Supabase (Auth, DB, RLS, Realtime, Edge Functions) + Square + External CRM webhooks

### Goals
- **Single source of truth** for services, pricing, availability, clients, bookings, orders.
- **Seamless booking + checkout** via Square with tokenization only (no PAN in servers).
- **Realtime admin + client portal** updates (appointments, orders, notifications).
- **Robust security** with RLS for all tables, role-based access, audit logging.
- **Sync to External CRM (GHL)** via outbound webhooks for contacts, bookings, orders.

---

## Conventions & Standards
- **IDs**: UUID v4 primary keys (ulid alternative acceptable if consistent).
- **Timestamps**: `created_at` (default now), `updated_at` (trigger), all UTC.
- **Soft-delete**: use `deleted_at` on entities that may be restored.
- **Multi-tenant**: not required MVP; design with future support in mind (no location_id, single business for now).
- **Currency**: store in minor units (cents) as integer; tax rates as decimal.
- **PII**: encrypt sensitive columns at rest where appropriate.
- **RLS**: enabled for all tables, least-privilege policies.
- **Naming**: snake_case for DB objects.
- **Time zone**: America/Los_Angeles for availability computation; store UTC in DB.

---

## Database Schema — TODO Checklist

### Auth
- [ ] `auth.users` (Supabase managed)
- [ ] `public.user_profiles`
  - [ ] Columns: `id (uuid PK -> auth.users.id)`, `role (enum: guest, client, admin)`, `full_name`, `phone`, `avatar_url`, `created_at`, `updated_at`
  - [ ] Unique: `phone` (nullable unique)
  - [ ] RLS: user can read/update own; admin full access

### People
- [ ] `public.clients`
  - [ ] Columns: `id (uuid PK)`, `user_id (uuid FK -> auth.users) NULL`, `email`, `first_name`, `last_name`, `phone`, `dob`, `notes`, `ghl_contact_id`, `created_at`, `updated_at`
  - [ ] Index: `email` unique (nullable unique with partial index), `phone` unique (nullable)
  - [ ] RLS: client self-access via `user_id`; admin read; admin write
- [ ] `public.addresses`
  - [ ] Columns: `id`, `owner_type (enum: client, business)`, `owner_id (uuid)`, `line1`, `line2`, `city`, `state`, `postal_code`, `country`, `is_default`, `created_at`, `updated_at`
  - [ ] Index: `(owner_type, owner_id)`
  - [ ] RLS: owner read/write; admin full
- [ ] `public.consents`
  - [ ] Columns: `id`, `client_id (uuid)`, `type (enum: email, sms, liability, privacy)`, `granted (bool)`, `granted_at`, `meta (jsonb)`
  - [ ] Unique: `(client_id, type)`
  - [ ] RLS: client self; admin read

### Services & Catalog
- [ ] `public.service_categories`
  - [ ] Columns: `id`, `name`, `slug`, `description`, `sort_order`, `visible (bool)`, `created_at`, `updated_at`
  - [ ] Unique: `slug`
  - [ ] RLS: public read for `visible=true`; admin manage
- [ ] `public.services`
  - [ ] Columns: `id`, `category_id (uuid)`, `name`, `slug`, `description`, `base_price_cents`, `base_duration_min`, `buffer_before_min`, `buffer_after_min`, `visible (bool)`, `draft (bool)`, `created_at`, `updated_at`
  - [ ] Unique: `slug`
  - [ ] RLS: public read for `visible=true AND draft=false`; admin manage
- [ ] `public.service_options` (aka variants/options altering duration/price)
  - [ ] Columns: `id`, `service_id (uuid)`, `name`, `price_delta_cents`, `duration_delta_min`, `sort_order`, `visible (bool)`
  - [ ] Index: `service_id`
  - [ ] RLS: read aligned with parent `services`
- [ ] `public.service_addons`
  - [ ] Columns: `id`, `service_id (uuid)`, `name`, `description`, `price_delta_cents`, `duration_delta_min`, `visible (bool)`
  - [ ] Index: `service_id`
- [ ] `public.service_prices` (seasonal/dated pricing)
  - [ ] Columns: `id`, `service_id`, `start_date`, `end_date`, `price_cents`
  - [ ] Constraint: non-overlapping ranges per service
 
- [ ] `public.service_blocks` (additional blocks or blackout per service)
  - [ ] Columns: `id`, `service_id`, `rule (jsonb)`

### Availability & Calendar
- [ ] `public.business_hours`
  - [ ] Columns: `id`, `weekday (int 0-6)`, `open_time (time)`, `close_time (time)`, `is_closed (bool)`
- [ ] `public.blackout_dates`
  - [ ] Columns: `id`, `date (date)`, `reason`
- [ ] `public.appointments`
  - [ ] Columns: `id`, `client_id`, `service_id`, `service_option_id NULL`, `start_at (timestamptz)`, `end_at (timestamptz)`, `status (enum: requested, approved, denied, cancelled, completed, no_show)`, `payment_status (enum: none, authorized, captured, refunded, failed)`, `notes`, `hold_expires_at`, `square_payment_id`, `created_at`, `updated_at`
  - [ ] Indexes: `(client_id, start_at desc)`, `start_at`, constraint preventing overlaps on confirm
  - [ ] RLS: client read own; admin full
- [ ] `public.appointment_addons`
  - [ ] Columns: `id`, `appointment_id`, `service_addon_id`
  - [ ] Unique: `(appointment_id, service_addon_id)`
- [ ] `public.appointment_status_history`
  - [ ] Columns: `id`, `appointment_id`, `from_status`, `to_status`, `changed_by (uuid)`, `changed_at`, `reason`

### Payments & Commerce
- [ ] `public.integration_accounts` (Square, CRM)
  - [ ] Columns: `id`, `provider (enum: square, ghl)`, `status (enum: connected, disconnected)`, `credentials (encrypted jsonb)`, `created_at`, `updated_at`
- [ ] `public.payment_methods` (Square refs only)
  - [ ] Columns: `id`, `client_id`, `square_customer_id`, `square_card_id`, `brand`, `last4`, `exp_month`, `exp_year`, `is_default`, `created_at`, `updated_at`
- [ ] `public.payments`
  - [ ] Columns: `id`, `client_id`, `amount_cents`, `currency`, `status (enum: created, authorized, captured, voided, refunded, failed)`, `square_payment_id`, `source (enum: booking, order)`, `source_id (uuid)`, `created_at`, `updated_at`, `meta (jsonb)`
  - [ ] Index: `(source, source_id)`
- [ ] `public.refunds`
  - [ ] Columns: `id`, `payment_id`, `amount_cents`, `reason`, `square_refund_id`, `status`, `created_at`
- [ ] `public.products`
  - [ ] Columns: `id`, `name`, `slug`, `description`, `brand`, `image_url`, `price_cents`, `compare_at_price_cents`, `affiliate_url`, `in_house (bool)`, `visible (bool)`, `created_at`, `updated_at`
  - [ ] Unique: `slug`
- [ ] `public.product_categories`
  - [ ] Columns: `id`, `name`, `slug`, `description`, `sort_order`, `created_at`, `updated_at`
  - [ ] Junction: `public.product_category_links (product_id, category_id)` unique pair
- [ ] `public.inventory`
  - [ ] Columns: `id`, `product_id`, `quantity_on_hand`, `quantity_reserved`, `reorder_threshold`, `updated_at`
- [ ] `public.carts`
  - [ ] Columns: `id`, `client_id NULL`, `session_id (text)`, `created_at`, `updated_at`
  - [ ] Unique: `session_id`
- [ ] `public.cart_items`
  - [ ] Columns: `id`, `cart_id`, `product_id`, `quantity`, `price_cents_snapshot`, `created_at`, `updated_at`
- [ ] `public.orders`
  - [ ] Columns: `id`, `client_id NULL`, `status (enum: pending, paid, fulfilled, cancelled, refunded)`, `subtotal_cents`, `tax_cents`, `shipping_cents`, `total_cents`, `pickup_in_store (bool)`, `affiliate (bool)`, `affiliate_url_snapshot`, `payment_id NULL`, `created_at`, `updated_at`
- [ ] `public.order_items`
  - [ ] Columns: `id`, `order_id`, `product_id`, `name_snapshot`, `unit_price_cents`, `quantity`, `total_cents`, `created_at`

### Content
- [ ] `public.modules` (educational modules)
  - [ ] Columns: `id`, `title`, `slug`, `description`, `content (jsonb or markdown)`, `visible (bool)`, `created_at`, `updated_at`
- [ ] `public.media_assets`
  - [ ] Columns: `id`, `owner_type (enum)`, `owner_id`, `url`, `alt_text`, `created_at`

### Communications (via HighLevel)
- [ ] Outbound notifications handled by HighLevel (GHL). No internal email/SMS templates.
- [ ] Optional: `public.notifications` for in-app admin toasts only
  - [ ] Columns: `id`, `recipient_type (enum: admin)`, `recipient_id`, `channel (enum: in_app)`, `template_key`, `payload (jsonb)`, `status (enum: queued, sent, failed)`, `created_at`

### Integrations & Webhooks
- [ ] `public.webhook_outbox` (GHL outbound only)
  - [ ] Columns: `id`, `event_type`, `payload (jsonb)`, `destination (enum: ghl)`, `status (enum: pending, delivered, failed)`, `attempts`, `last_error`, `created_at`, `updated_at`
- [ ] `public.webhook_inbox` (Square inbound only)
  - [ ] Columns: `id`, `source (enum: square)`, `event_type`, `payload (jsonb)`, `received_at`, `processed_at`, `status`, `error`
- [ ] `public.audit_log`
  - [ ] Columns: `id`, `actor_type (enum: user, system)`, `actor_id`, `action`, `entity`, `entity_id`, `before (jsonb)`, `after (jsonb)`, `created_at`

### Settings & Policy
- [ ] `public.business_settings`
  - [ ] Columns: `id (singleton)`, `business_name`, `phone`, `email`, `address (jsonb)`, `timezone`, `cancellation_window_hours`, `reschedule_limit`, `booking_increment_min`, `min_start_lead_min`, `max_booking_horizon_days`, `payments_mode (enum: authorize, capture)`, `tax_rate_pct`, `shipping_config (jsonb)`, `created_at`, `updated_at`

---

## Security & RLS — TODO Checklist
- [ ] Enable RLS on all tables
- [ ] Create roles: `anon`, `authenticated`, `service_role` (server), with policies:
  - [ ] Public read on `service_categories`, `services`, `service_options`, `service_addons` where `visible=true AND draft=false`
  - [ ] Clients: read/update own `clients` via `user_id`, `payment_methods`, `appointments` (own), `orders`
  - [ ] Admin: full access via `user_profiles.role='admin'`
- [ ] Row-level constraints for appointment overlap during confirmation (see Edge Function)
- [ ] Column encryption for PII (phone; use pgcrypto or Supabase Vault where applicable)
- [ ] Audit triggers on critical tables (services, appointments, orders)

---

## Realtime Channels — TODO Checklist
- [ ] `appointments` channel: broadcast create/update status changes
- [ ] `orders` channel: broadcast payment and fulfillment status
- [ ] Optional: `admin_notifications` channel for in-app toasts (admin only)
- [ ] Security: limit subscription by role and record ownership

---

## Edge Functions / RPCs — TODO Checklist

### Scheduling & Booking
- [ ] `compute_available_slots(service_id, date_range)`
  - [ ] Inputs: service duration + buffers, business hours, blackouts, existing appointments
  - [ ] Output: ISO timestamps for eligible slots; respect booking increment and lead time
- [ ] `confirm_booking(payload)` atomic transaction
  - [ ] Steps: hold/capture via Square, create appointment, conflict guard, emit events, write outbox
  - [ ] Idempotency key support
- [ ] `reschedule_booking(appointment_id, new_slot)` with policy checks
- [ ] `cancel_booking(appointment_id, reason)` with late cancel/no-show logic

### Payments (Square)
- [ ] `create_payment_intent` or `create_payment` (per mode)
- [ ] `capture_payment(payment_id)` / `void_payment(payment_id)`
- [ ] `refund_payment(payment_id, amount)`
- [ ] `save_card_on_file(client_id, token)` → create customer + card, store refs

### Webhooks
- [ ] `square_webhook_handler` (signature verify)
  - [ ] Handle `payment.updated`, `refund.updated`; reconcile `payments`, `orders`, `appointments`
  

### CRM Sync (Outbound)
- [ ] `enqueue_outbox(event_type, payload)` helper
- [ ] `deliver_outbox` scheduler/cron with retry + DLQ semantics
  - [ ] Events: `contact.upsert`, `booking.created|approved|cancelled`, `order.created`

### Content & Files
- [ ] Signed URL helpers for `media_assets` via Supabase Storage
- [ ] PDF receipt/ICS generation endpoints (server-side)

---

## Data Import & Seeding — TODO Checklist
- [ ] Import `context/clients_export_2025-08-26.csv` → `clients`
- [ ] Import `context/RETAIL_ The Room Spa - Sheet1.csv` → `products`, `product_categories`
- [ ] Import `context/Checkout Line Items-2025-08-27.csv` → `orders`, `order_items` (best-effort historical mapping)
- [ ] Seed `services` from `context/services.md`
- [ ] Seed waiver and liability text from `context/waiver form.md` into `modules` or `templates`
- [ ] Backfill `business_settings` sensible defaults
- [ ] Mapping: attempt to join orders to clients by email/phone; log unmatched in audit

---

## Validation & Constraints — TODO Checklist
- [ ] Non-overlapping `service_prices` per service
- [ ] Appointment `end_at = start_at + duration + buffers (+ addons/options deltas)`
- [ ] Payment/order totals integrity via triggers or computed checks
- [ ] Inventory decrement on paid order; restock on refund/cancel
- [ ] Prevent checkout for `affiliate_url` products (redirect to affiliate)
- [ ] Pickup-only toggle when `in_house=true`

---

## Notifications — TODO Checklist (Handled by HighLevel)
- [ ] Enqueue outbound events to GHL via `webhook_outbox` on key events:
  - [ ] Booking requested/approved/denied/cancelled
  - [ ] Payment success/failure, refund
  - [ ] Order created/fulfilled/cancelled
- [ ] Optional: in-app admin toasts via realtime `admin_notifications` only

---

## Testing & QA — TODO Checklist
- [ ] Unit: slot computation, pricing deltas (options/addons), overlap guard
- [ ] Integration: confirm booking with Square webhook reconciliation
- [ ] E2E: guest booking, returning booking, reschedule, deny/approve, shop order, refund
- [ ] Accessibility: none for backend, but ensure endpoints support frontend a11y needs
- [ ] Load: concurrent booking attempts (100 RPS burst) on same slot

---

## Observability & Ops — TODO Checklist
- [ ] Structured logging in edge functions (request ids, idempotency keys)
- [ ] Error reporting and alerting (Supabase logs + external)
- [ ] Webhook dead-letter queue processing + dashboard visibility
- [ ] Metrics: API latency, error rates, webhook delivery success, outbox backlog

---

## Acceptance Criteria Cross-Check
- [ ] Services edited in Admin appear on `/services` and Booking within 5s (realtime or cache bust)
- [ ] Approve/Deny updates appointment status, notifies client, updates calendars instantly
- [ ] Square payment success/failure reconciles to single source of truth in DB
- [ ] Booking never offers past/blocked slots; confirm prevents overlaps (<1% double-booking)
- [ ] Guest checkout for shop and booking; account optional
- [ ] Admin sidebar always visible (frontend) — ensure APIs support real-time data

---

## Open Questions / Follow-ups
- [ ] Tips/gratuity support (future)
- [ ] Gift cards, memberships, packages
- [ ] Multi-therapist simultaneous bookings (couples)
- [ ] Loyalty points and referrals


