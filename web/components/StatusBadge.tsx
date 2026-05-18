type Status =
  | "queued"
  | "processing"
  | "processed"
  | "needs_review"
  | "needs_mapping"
  | "error";

const MAP: Record<Status, { color: string; label: string }> = {
  queued:        { color: "#3a4a5a", label: "QUEUED" },
  processing:    { color: "#f59e0b", label: "PROCESSING" },
  processed:     { color: "#10b981", label: "PROCESSED" },
  needs_review:  { color: "#ef4444", label: "NEEDS REVIEW" },
  needs_mapping: { color: "#3b82f6", label: "NEEDS MAPPING" },
  error:         { color: "#ef4444", label: "ERROR" },
};

export function StatusBadge({ status }: { status: string }) {
  const meta = MAP[status as Status] ?? { color: "#3a4a5a", label: status };
  return (
    <span className="status">
      <span className="status-dot" style={{ background: meta.color }} />
      <span style={{ color: meta.color }}>{meta.label}</span>
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const col =
    role === "admin"
      ? "#ef4444"
      : role === "accountant"
      ? "#3b82f6"
      : "#10b981";
  return (
    <span
      className="pill"
      style={{ color: col, border: `1px solid ${col}33`, background: `${col}0d` }}
    >
      {role}
    </span>
  );
}
