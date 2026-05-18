"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/Icons";

const CANONICAL: { key: TemplateField; label: string }[] = [
  { key: "invoiceDateLabel",     label: "INVOICE DATE" },
  { key: "invoiceNumberLabel",   label: "INVOICE NUMBER" },
  { key: "clientNameLabel",      label: "CLIENT NAME" },
  { key: "amountBeforeGstLabel", label: "AMOUNT BEFORE GST" },
  { key: "amountAfterGstLabel",  label: "AMOUNT AFTER GST" },
];

type TemplateField =
  | "invoiceDateLabel"
  | "invoiceNumberLabel"
  | "clientNameLabel"
  | "amountBeforeGstLabel"
  | "amountAfterGstLabel";

type Props = {
  vendorId: string;
  vendorName: string;
  ocrLabels: string[];
  existing: Partial<Record<TemplateField, string>>;
  invoiceId?: string;
};

export function TemplateMapper({ vendorId, vendorName, ocrLabels, existing, invoiceId }: Props) {
  const router = useRouter();
  const [map, setMap] = useState<Record<TemplateField, string>>({
    invoiceDateLabel:     existing.invoiceDateLabel ?? "",
    invoiceNumberLabel:   existing.invoiceNumberLabel ?? "",
    clientNameLabel:      existing.clientNameLabel ?? "",
    amountBeforeGstLabel: existing.amountBeforeGstLabel ?? "",
    amountAfterGstLabel:  existing.amountAfterGstLabel ?? "",
  });
  const [saved, setSaved] = useState(false);
  const [saving, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const filledCount = Object.values(map).filter((v) => v && v !== "—").length;
  const done = filledCount === CANONICAL.length;

  function save() {
    setErr(null);
    startTransition(async () => {
      const res = await fetch(`/api/vendors/${vendorId}/template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...map, retryInvoiceId: invoiceId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErr(body?.error ?? `Save failed (${res.status})`);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  if (saved) {
    return (
      <div style={{ border: "1px solid var(--border)", maxWidth: 460, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)" }} />
          <span className="mono" style={{ fontSize: 11, color: "var(--white)", letterSpacing: "0.06em" }}>TEMPLATE SAVED</span>
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.7, marginBottom: 20 }}>
          Future invoices from <span style={{ color: "var(--white)" }}>{vendorName}</span> will be extracted automatically.
          {invoiceId && <> The pending invoice has been re-processed with the new template.</>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/vendors" className="btn-ghost">Back to vendors</Link>
          {invoiceId && (
            <Link href={`/invoices/${invoiceId}`} className="btn-amber">View invoice →</Link>
          )}
        </div>
      </div>
    );
  }

  const opts = ocrLabels.length > 0 ? ["—", ...ocrLabels] : ["—"];

  return (
    <div className="mapper-card">
      <div className="mapper-head">
        <div className="mapper-title">Field mapping — one time only</div>
        <div className="mapper-vendor">{vendorName}</div>
        {ocrLabels.length === 0 && (
          <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>
            No OCR labels available yet. Upload an invoice from this vendor to populate the dropdowns automatically.
          </div>
        )}
      </div>

      <div className="mapper-body">
        {CANONICAL.map(({ key, label }) => (
          <div key={key} className="map-row">
            <div className="map-canonical">{label}</div>
            <span className="map-arrow">→</span>
            {ocrLabels.length > 0 ? (
              <select
                value={map[key]}
                onChange={(e) => setMap((m) => ({ ...m, [key]: e.target.value }))}
                className={`map-select${map[key] && map[key] !== "—" ? " mapped" : ""}`}
              >
                {opts.map((o) => <option key={o} value={o === "—" ? "" : o}>{o}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={map[key]}
                onChange={(e) => setMap((m) => ({ ...m, [key]: e.target.value }))}
                placeholder="Enter label text"
                className={`map-select${map[key] && map[key] !== "—" ? " mapped" : ""}`}
                style={{ paddingLeft: 12 }}
              />
            )}
          </div>
        ))}
        {err && <div className="mono" style={{ color: "var(--red)", fontSize: 10, marginTop: 8 }}>{err}</div>}
      </div>

      <div className="mapper-foot">
        <button
          className={done ? "btn-amber" : "btn-ghost"}
          disabled={!done || saving}
          style={{ width: "100%", padding: "10px 0", cursor: done && !saving ? "pointer" : "not-allowed" }}
          onClick={save}
        >
          {saving ? "Saving…" : done ? "Save template" : `${filledCount} / ${CANONICAL.length} mapped`}
        </button>
      </div>
    </div>
  );
}

export { Icon };
