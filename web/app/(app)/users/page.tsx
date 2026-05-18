import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { RoleBadge } from "@/components/StatusBadge";
import { fmtDateTime } from "@/lib/format";

export default async function UsersPage() {
  const session = await auth();
  if (session?.user.role !== "admin") redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="fade-in">
      <div className="section-head">
        <span className="section-title">All users</span>
        <div className="section-rule" />
        <span className="section-count">{users.length} total</span>
      </div>

      <div className="tbl-wrap" style={{ maxWidth: 760 }}>
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Last login</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ cursor: "default" }}>
                <td className="td-white" style={{ fontSize: 12 }}>{u.name}</td>
                <td className="td-mono td-muted">{u.email}</td>
                <td><RoleBadge role={u.role} /></td>
                <td className="td-mono td-muted">{fmtDateTime(u.lastLogin)}</td>
                <td>
                  <span className={`badge ${u.isActive ? "badge-ok" : "badge-err"}`}>
                    {u.isActive ? "ACTIVE" : "DISABLED"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 12, lineHeight: 1.7 }}>
        User create / edit / deactivate UI is part of the admin runbook (Phase 4). For the demo, manage users via{" "}
        <span style={{ color: "var(--fg)" }}>prisma/seed.ts</span> or{" "}
        <span style={{ color: "var(--fg)" }}>npm run db:studio</span>.
      </div>
    </div>
  );
}
