"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icons";

const STEPS = [
  "Reading PDF",
  "Running PaddleOCR",
  "Detecting vendor",
  "Matching template",
  "Extracting fields",
];

type JobStatus = {
  invoiceId: string;
  status: "queued" | "processing" | "processed" | "needs_review" | "needs_mapping" | "error";
  stage: number;        // 0..STEPS.length
  vendorName?: string | null;
  vendorId?: string | null;
  fields?: {
    invoiceNumber?: string;
    invoiceDate?: string | null;
    clientName?: string | null;
    amountBeforeGst?: number | null;
    amountAfterGst?: number | null;
  };
  error?: string;
};

type UIState =
  | { kind: "idle" }
  | { kind: "uploading"; fileName: string }
  | { kind: "processing"; fileName: string; job: JobStatus }
  | { kind: "done"; fileName: string; job: JobStatus }
  | { kind: "needs_mapping"; fileName: string; job: JobStatus }
  | { kind: "error"; fileName: string; message: string };

export function UploadClient() {
  const [drag, setDrag] = useState(false);
  const [state, setState] = useState<UIState>({ kind: "idle" });
  const ref = useRef<HTMLInputElement>(null);

  function pick(f?: File | null) {
    if (!f) return;
    if (f.type !== "application/pdf") {
      setState({ kind: "error", fileName: f.name, message: "Only PDF files accepted" });
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setState({ kind: "error", fileName: f.name, message: "File exceeds 20MB limit" });
      return;
    }
    void upload(f);
  }

  async function upload(file: File) {
    setState({ kind: "uploading", fileName: file.name });
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/invoices/upload", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState({ kind: "error", fileName: file.name, message: body?.error ?? `Upload failed (${res.status})` });
        return;
      }
      const data = await res.json();
      setState({ kind: "processing", fileName: file.name, job: { invoiceId: data.invoiceId, status: "queued", stage: 0 } });
    } catch (e) {
      setState({ kind: "error", fileName: file.name, message: e instanceof Error ? e.message : "Network error" });
    }
  }

  // Poll for job status while processing
  useEffect(() => {
    if (state.kind !== "processing") return;
    const id = state.job.invoiceId;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/invoices/${id}/job`);
        if (!res.ok) return;
        const job: JobStatus = await res.json();
        if (cancelled) return;
        if (job.status === "processed" || job.status === "needs_review") {
          setState((s) => s.kind === "processing" ? { kind: "done", fileName: s.fileName, job } : s);
        } else if (job.status === "needs_mapping") {
          setState((s) => s.kind === "processing" ? { kind: "needs_mapping", fileName: s.fileName, job } : s);
        } else if (job.status === "error") {
          setState((s) => s.kind === "processing" ? { kind: "error", fileName: s.fileName, message: job.error ?? "Processing failed" } : s);
        } else {
          setState((s) => s.kind === "processing" ? { ...s, job } : s);
        }
      } catch {
        // transient, ignore
      }
    };
    const t = setInterval(tick, 800);
    tick();
    return () => { cancelled = true; clearInterval(t); };
  }, [state.kind === "processing" ? state.job.invoiceId : null]);

  if (state.kind === "done") {
    const f = state.job.fields ?? {};
    return (
      <div className="success-card">
        <div className="success-head">
          <div className="success-dot" />
          <span className="success-title">
            EXTRACTION {state.job.status === "needs_review" ? "FLAGGED" : "COMPLETE"}
          </span>
        </div>
        <div className="success-body">
          <Row k="Invoice date"      v={f.invoiceDate ?? "—"} />
          <Row k="Invoice number"    v={f.invoiceNumber ?? "—"} />
          <Row k="Client name"       v={f.clientName ?? "—"} />
          <Row k="Amount before GST" v={f.amountBeforeGst != null ? "₹" + f.amountBeforeGst.toLocaleString("en-IN") : "—"} />
          <Row k="Amount after GST"  v={f.amountAfterGst != null ? "₹" + f.amountAfterGst.toLocaleString("en-IN") : "—"} />
          <Row k="Vendor"            v={state.job.vendorName ?? "—"} />
          <div className="success-actions">
            <button className="btn-ghost" onClick={() => setState({ kind: "idle" })}>Upload another</button>
            <Link className="btn-amber" href={`/invoices/${state.job.invoiceId}`}>View invoice →</Link>
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === "needs_mapping") {
    return (
      <div className="success-card">
        <div className="success-head">
          <div className="success-dot" style={{ background: "var(--blue, #3b82f6)" }} />
          <span className="success-title">NEW VENDOR · MAPPING REQUIRED</span>
        </div>
        <div className="success-body">
          <div className="mono" style={{ fontSize: 11, color: "var(--white)", lineHeight: 1.7, marginBottom: 16 }}>
            We detected <span style={{ color: "var(--amber)" }}>{state.job.vendorName ?? "an unmapped vendor"}</span>. Map their fields once,
            and every future invoice from them will be extracted automatically.
          </div>
          <div className="success-actions">
            <button className="btn-ghost" onClick={() => setState({ kind: "idle" })}>Upload another</button>
            {state.job.vendorId && (
              <Link className="btn-amber" href={`/vendors/${state.job.vendorId}/template?invoice=${state.job.invoiceId}`}>
                Map template →
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === "processing" || state.kind === "uploading") {
    const stage = state.kind === "processing" ? state.job.stage : 0;
    return (
      <div className="proc-wrap">
        <div className="proc-head">
          <div className="proc-head-title">Processing · {state.fileName}</div>
        </div>
        <div className="proc-body">
          {STEPS.map((s, i) => (
            <div key={s} className="proc-step">
              <div className={`proc-ind ${i < stage ? "done" : i === stage ? "active" : ""}`}>
                {i < stage ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 13 4 11" />
                  </svg>
                ) : i === stage ? (
                  <Icon name="spin" size={10} color="var(--amber)" />
                ) : (
                  <div style={{ width: 4, height: 4, background: "var(--muted)", borderRadius: "50%" }} />
                )}
              </div>
              <span className={`proc-step-txt ${i <= stage ? "active" : ""}`}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="success-card" style={{ borderColor: "var(--red)" }}>
        <div className="success-head" style={{ borderColor: "var(--red)" }}>
          <div className="success-dot" style={{ background: "var(--red)" }} />
          <span className="success-title">UPLOAD FAILED · {state.fileName}</span>
        </div>
        <div className="success-body">
          <div className="mono" style={{ fontSize: 11, color: "var(--red)", marginBottom: 16 }}>{state.message}</div>
          <button className="btn-ghost" onClick={() => setState({ kind: "idle" })}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`upload-zone${drag ? " drag" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
      onClick={() => ref.current?.click()}
    >
      <div className="upload-dot">
        <Icon name="upload" size={16} color="var(--muted)" />
      </div>
      <div className="upload-title">Drop invoice PDF here</div>
      <div className="upload-sub" style={{ marginTop: 4 }}>or click to browse · max 20MB</div>
      <input
        ref={ref}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: "none" }}
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="success-row">
      <span className="success-key">{k}</span>
      <span className="success-val">{v}</span>
    </div>
  );
}
