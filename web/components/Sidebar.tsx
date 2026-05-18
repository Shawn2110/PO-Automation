"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icons";

type NavItem = { href: string; label: string; icon: IconName; roles: string[] };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", roles: ["admin", "accountant", "viewer"] },
  { href: "/invoices",  label: "Invoices",  icon: "invoices",  roles: ["admin", "accountant", "viewer"] },
  { href: "/upload",    label: "Upload",    icon: "upload",    roles: ["admin", "accountant"] },
  { href: "/vendors",   label: "Vendors",   icon: "vendors",   roles: ["admin", "accountant"] },
  { href: "/users",     label: "Users",     icon: "users",     roles: ["admin"] },
];

export function Sidebar({
  role,
  email,
  signOutAction,
}: {
  role: string;
  email: string;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const visible = NAV.filter((n) => n.roles.includes(role));

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-dot" />
          <span className="logo-text">PO · AUTO</span>
        </div>
        <div className="logo-sub">BuildCo Infra</div>
      </div>

      <nav className="nav">
        <div style={{ height: 8 }} />
        {visible.map(({ href, label, icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} className={`nav-item${isActive ? " active" : ""}`}>
              <Icon name={icon} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="role-badge">
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--amber)" }} />
          {role}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", marginBottom: 8, wordBreak: "break-all" }}>
          {email}
        </div>
        <form action={signOutAction}>
          <button type="submit" className="signout-btn">Sign out →</button>
        </form>
      </div>
    </aside>
  );
}
