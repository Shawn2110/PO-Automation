"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icons";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/invoices":  "Invoices",
  "/upload":    "Upload",
  "/vendors":   "Vendors",
  "/users":     "Users",
};

function titleFor(pathname: string): string {
  for (const key of Object.keys(TITLES)) {
    if (pathname === key || pathname.startsWith(key + "/")) return TITLES[key];
  }
  return "Dashboard";
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [today, setToday] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }));
  }, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    router.push(`/invoices?q=${encodeURIComponent(term)}`);
  }

  return (
    <div className="topbar">
      <span className="topbar-title">{titleFor(pathname)}</span>
      <div className="topbar-sep" />
      <span className="topbar-date">{today}</span>
      <div className="topbar-right">
        <form onSubmit={submitSearch} className="search-box">
          <Icon name="search" size={11} color="var(--muted)" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search invoices…"
          />
        </form>
      </div>
    </div>
  );
}
