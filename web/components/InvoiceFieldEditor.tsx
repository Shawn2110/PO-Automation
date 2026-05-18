"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type FieldKey =
  | "invoiceNumber"
  | "invoiceDate"
  | "clientName"
  | "amountBeforeGst"
  | "amountAfterGst";

type Props = {
  invoiceId: string;
  field: FieldKey;
  label: string;
  initialValue: string;
  type?: "text" | "number" | "date";
  canEdit: boolean;
  lowConfidence?: boolean;
};

export function InvoiceFieldEditor({
  invoiceId, field, label, initialValue, type = "text", canEdit, lowConfidence,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [saving, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function save() {
    setErr(null);
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setErr(body?.error ?? `Save failed (${res.status})`);
      return false;
    }
    return true;
  }

  function commit() {
    startTransition(async () => {
      const ok = await save();
      if (ok) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  const display = type === "number"
    ? (initialValue ? "₹" + new Intl.NumberFormat("en-IN").format(Number(initialValue)) : "—")
    : (initialValue || "—");

  return (
    <div className="field-cell">
      <div className="field-label">
        {label}
        {lowConfidence && <span className="field-edit-hint" style={{ color: "var(--amber)" }}>· LOW CONF</span>}
      </div>
      {editing ? (
        <div>
          <input
            type={type}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={saving}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setEditing(false); setValue(initialValue); setErr(null); }
            }}
            style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--amber)", color: "var(--amber)", fontFamily: "var(--font-mono)", fontSize: 13, padding: "4px 6px", outline: "none" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button onClick={commit} disabled={saving} className="btn-amber" style={{ padding: "4px 10px", flex: "none" }}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setEditing(false); setValue(initialValue); setErr(null); }} disabled={saving} className="btn-ghost" style={{ padding: "4px 10px", flex: "none" }}>
              Cancel
            </button>
          </div>
          {err && <div className="mono" style={{ color: "var(--red)", fontSize: 10, marginTop: 4 }}>{err}</div>}
        </div>
      ) : (
        <div className="field-val" onClick={() => canEdit && setEditing(true)} style={{ cursor: canEdit ? "text" : "default" }}>
          {display}
          {canEdit && <span className="field-edit-hint">· CLICK TO EDIT</span>}
        </div>
      )}
    </div>
  );
}
