import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect(`/login?error=${encodeURIComponent("Invalid email or password")}`);
    }
    throw err;
  }
}

async function quickLoginAccountant() {
  "use server";
  try {
    await signIn("credentials", {
      email: "accountant@buildco.in",
      password: "accountant123",
      redirectTo: "/dashboard",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect(`/login?error=${encodeURIComponent("Demo account unavailable")}`);
    }
    throw err;
  }
}

async function quickLoginViewer() {
  "use server";
  try {
    await signIn("credentials", {
      email: "viewer@buildco.in",
      password: "viewer123",
      redirectTo: "/dashboard",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect(`/login?error=${encodeURIComponent("Demo account unavailable")}`);
    }
    throw err;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="min-h-screen flex flex-col md:flex-row">
      {/* Brand panel */}
      <aside
        className="md:w-[42%] md:min-h-screen px-8 py-10 md:px-12 md:py-14 flex flex-col justify-between"
        style={{
          background: "color-mix(in srgb, var(--amber) 8%, var(--bg))",
          borderRight: "1px solid var(--border)",
        }}
      >
        <div>
          <div className="flex items-center gap-2.5 mb-12">
            <span className="w-2 h-2 rounded-full bg-amber" />
            <span className="mono text-[11px] tracking-[0.14em] uppercase text-amber">
              PO · AUTO
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-medium leading-tight mb-4" style={{ color: "var(--fg)" }}>
            Vendor invoice extraction,<br/>
            <span style={{ color: "var(--amber)" }}>automated.</span>
          </h1>
          <p className="text-sm leading-relaxed text-muted max-w-md mb-10">
            BuildCo Infra&apos;s internal tool for processing vendor invoices —
            drop a PDF, the VLM reads it, your accountant reviews and ships.
          </p>

          <ul className="mono text-[11px] tracking-[0.06em] uppercase space-y-2.5" style={{ color: "var(--fg)" }}>
            {[
              "Drag-and-drop PDF intake",
              "Qwen2.5-VL extracts GST + 5 fields",
              "Audit log on every edit",
              "CSV / XLSX export",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-amber flex-none" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mono text-[10px] tracking-[0.12em] uppercase text-muted mt-12 md:mt-0">
          BuildCo Infra · v0.1 demo
        </div>
      </aside>

      {/* Form panel */}
      <section className="flex-1 flex items-center justify-center px-6 py-10 md:py-14">
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-medium mb-1" style={{ color: "var(--fg)" }}>Sign in</h2>
          <p className="text-muted text-xs mb-8">
            Use a seeded demo account, or sign in with credentials below.
          </p>

          <form action={loginAction} className="space-y-4">
            <div>
              <label className="mono text-[10px] tracking-[0.12em] uppercase text-muted block mb-1.5">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="accountant@buildco.in"
                className="w-full bg-off border border-border-2 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-amber transition"
              />
            </div>

            <div>
              <label className="mono text-[10px] tracking-[0.12em] uppercase text-muted block mb-1.5">
                Password
              </label>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••••"
                className="w-full bg-off border border-border-2 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-amber transition"
              />
            </div>

            {error && (
              <div
                className="mono text-[11px] px-3 py-2 rounded-sm"
                style={{
                  border: "1px solid #dc2626",
                  background: "color-mix(in srgb, #dc2626 8%, transparent)",
                  color: "#dc2626",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-amber text-bg font-medium py-2.5 rounded-sm hover:opacity-90 transition mono text-[11px] tracking-[0.14em] uppercase"
            >
              Sign in
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span className="mono text-[9px] tracking-[0.14em] uppercase text-muted">
              or use a demo account
            </span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          <div className="space-y-2.5">
            <form action={quickLoginAccountant}>
              <button
                type="submit"
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-sm border transition hover:border-amber group"
                style={{
                  borderColor: "var(--border-2)",
                  background: "var(--off)",
                }}
              >
                <span className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2563eb" }} />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Accountant</span>
                  <span className="mono text-[10px] text-muted">read &amp; write</span>
                </span>
                <span className="mono text-[10px] text-muted group-hover:text-amber transition">sign in →</span>
              </button>
            </form>

            <form action={quickLoginViewer}>
              <button
                type="submit"
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-sm border transition hover:border-amber group"
                style={{
                  borderColor: "var(--border-2)",
                  background: "var(--off)",
                }}
              >
                <span className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#059669" }} />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Viewer</span>
                  <span className="mono text-[10px] text-muted">read-only</span>
                </span>
                <span className="mono text-[10px] text-muted group-hover:text-amber transition">sign in →</span>
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
