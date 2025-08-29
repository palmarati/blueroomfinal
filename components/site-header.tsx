"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/booking", label: "Booking" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

type SessionInfo = { isAuth: boolean; isAdmin: boolean };

export function SiteHeader() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({ isAuth: false, isAdmin: false });

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const isAuth = Boolean(session.session);
      let isAdmin = false;
      if (isAuth) {
        const userId = session.session!.user.id;
        const { data } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
        isAdmin = Boolean(data?.user_id);
      }
      setSessionInfo({ isAuth, isAdmin });
    })();
  }, [supabase]);
  return (
    <header className="w-full border-b">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold">Blue Room Spa</Link>
        <nav className="flex items-center gap-4 text-sm">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href
                  ? "underline underline-offset-4"
                  : "hover:underline underline-offset-4"
              }
            >
              {link.label}
            </Link>
          ))}
          {!sessionInfo.isAuth && (
            <Link href="/auth/login" className="hover:underline underline-offset-4">
              Sign in
            </Link>
          )}
          {sessionInfo.isAuth && (
            <>
              {sessionInfo.isAdmin ? (
                <Link href="/dashboard" className="hover:underline underline-offset-4">Dashboard</Link>
              ) : (
                <Link href="/portal" className="hover:underline underline-offset-4">Portal</Link>
              )}
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = "/";
                }}
                className="hover:underline underline-offset-4"
              >
                Sign out
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}


