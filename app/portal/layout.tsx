import Link from "next/link";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-4">Client Portal</h1>
      <nav className="flex items-center gap-4 mb-4 text-sm">
        <Link className="underline" href="/portal/appointments">Appointments</Link>
        <Link className="underline" href="/portal/modules">Modules</Link>
        <Link className="underline" href="/portal/profile">Profile</Link>
      </nav>
      {children}
    </div>
  );
}


