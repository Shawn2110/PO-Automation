type Status =
  | "queued"
  | "processing"
  | "processed"
  | "needs_review"
  | "needs_mapping"
  | "error";

// Deepened colors for AA contrast on the light Mineral Cartography theme.
const MAP: Record<Status, { color: string; label: string }> = {
  queued:        { color: "#6b6b65", label: "QUEUED" },
  processing:    { color: "#b45309", label: "PROCESSING" },
  processed:     { color: "#059669", label: "PROCESSED" },
  needs_review:  { color: "#dc2626", label: "NEEDS REVIEW" },
  needs_mapping: { color: "#2563eb", label: "NEEDS MAPPING" },
  error:         { color: "#dc2626", label: "ERROR" },
};

export function StatusBadge({ status }: { status: string }) {
  const meta = MAP[status as Status] ?? { color: "#6b6b65", label: status };
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
      ? "#dc2626"
      : role === "accountant"
      ? "#2563eb"
      : "#059669";
  return (
    <span
      className="pill"
      style={{ color: col, border: `1px solid ${col}55`, background: `${col}14` }}
    >
      {role}
    </span>
  );
}
