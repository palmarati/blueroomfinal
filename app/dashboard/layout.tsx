import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="border-r p-4 space-y-3">
        <div className="font-semibold">Admin</div>
        <nav className="flex flex-col gap-2 text-sm">
          <Link href="/dashboard" className="underline">Overview</Link>
          <Link href="/dashboard/services" className="underline">Services</Link>
          <Link href="/dashboard/services/options" className="underline">Service Options</Link>
          <Link href="/dashboard/addons" className="underline">Add-ons</Link>
          <Link href="/dashboard/clients" className="underline">Clients</Link>
          <Link href="/dashboard/calendar" className="underline">Calendar</Link>
          <Link href="/dashboard/shop" className="underline">Shop</Link>
          <Link href="/dashboard/settings" className="underline">Settings</Link>
        </nav>
      </aside>
      <main>{children}</main>
    </div>
  );
}


