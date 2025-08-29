## Pages

- **Home** /: The marketing landing page introducing The Blue Room Spa. Highlights services with live data, a hero CTA to book or shop, testimonials, and service cards that open a selection modal or route directly into booking.

- **About** /about: Brand and story page featuring location and philosophy. Presents a hero, bio, imagery, and policies in a long-form, content-first layout.

- **Services** /services: Full catalog of live services and add-ons fetched from the database, with category filters and booking CTAs. If a service has options, users pick a variant; otherwise it routes straight into the booking flow.

- **Contact** /contact: Contact and inquiry page with an embedded form widget and business details. Shows address, phone, email, hours pulled from Business Settings, plus booking policy notes.

- **Booking** /booking: Guided booking flow where users choose date/time and complete an appointment request (optionally with a preselected service). Respects business rules like min notice, max advance window, and slot duration.

- **Booking Success** /booking-success: Confirmation page shown after a booking request or paid deposit. Communicates next steps, reference info, and links to book again or return home.

- **Shop** /shop: Customer-facing retail catalog with brand/category filters and cart modal. Displays live, in-stock or affiliate products with quick add-to-cart and a CTA to begin booking.

- **Client Portal** /portal: Authenticated portal for clients to review upcoming/past bookings, cancel or reschedule, access modules, manage payment method, and update profile. Uses real-time updates to reflect appointment changes.

- **Auth** /auth: Simple sign-in screen using Supabase auth. On success, redirects admins to the dashboard and clients to the portal.

- **Privacy Policy** /privacy: Static policy content describing data collection, usage, security, and user rights. Includes quick navigation back button.

- **Terms of Service** /terms: Static terms covering booking/cancellation, payment terms, health/safety, and liability. Includes quick navigation back button.

- **Not Found** /*: Generic 404 page for unmatched routes. Offers a link back to home.

- **Dashboard** /dashboard: Admin area for managing calendar, analytics, clients, services, shop, and settings. Access is protected; the base path renders the calendar view.
    - **Calendar** /dashboard/calendar: Weekly calendar with pending requests, today view, and appointment CRUD. Uses default calendar color and Pacific Time for display.
    - **Analytics** /dashboard/analytics: KPIs and trend summaries (revenue, utilization, retention, bookings) over recent periods. Pulls data from appointments and clients with basic derived metrics.
    - **Clients** /dashboard/clients: Client directory with search, portal badge, upcoming appointment indicators, and details modal. Shows basic LTV and portal membership signals.
    - **Services & Add-ons** /dashboard/services: Manage services, add-ons, categories, options, order, and visibility. Supports drag-to-reorder and real-time updates.
    - **Shop Admin** /dashboard/shop: Retail management with tabs for products and taxonomy (brands/categories). Used to keep the storefront up to date.
    - **Settings** /dashboard/settings: Business settings including policies, booking controls, notifications, and payment preferences. Persists to `business_settings` in the database.
    - **Webhooks** /dashboard/webhooks: Configure and test outbound webhooks (e.g., GoHighLevel) and review recent delivery logs. Saves URL to Business Settings and supports test payload sends.
    - **Pending Approvals** /dashboard/approvals: Queue of booking requests awaiting manual approval or denial. Sends approval/denial webhooks and updates appointment status accordingly.
    - **Business Settings** /dashboard/business-settings: Centralized business info, hours, booking rules, and webhook tab. Supports save/verify cycle and read-only guard when applicable.


