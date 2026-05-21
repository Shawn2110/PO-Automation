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

async function quickLogin(email: string, password: string) {
  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect(`/login?error=${encodeURIComponent("Demo account unavailable")}`);
    }
    throw err;
  }
}

async function quickLoginAccountant() {
  "use server";
  await quickLogin("accountant@buildco.in", "accountant123");
}

async function quickLoginViewer() {
  "use server";
  await quickLogin("viewer@buildco.in", "viewer123");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="min-h-screen grid md:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      {/* ─── Brand panel ─── */}
      <aside
        className="relative px-8 py-12 md:px-14 md:py-16 flex flex-col"
        style={{
          background: "color-mix(in srgb, var(--amber) 5%, var(--bg))",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Top: brand mark */}
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--amber)",
              boxShadow: "0 0 0 4px color-mix(in srgb, var(--amber) 12%, transparent)",
            }}
          />
          <span
            className="mono"
            style={{
              fontSize: 10.5,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--amber)",
              fontWeight: 500,
            }}
          >
            BuildCo Infra · PO Auto
          </span>
        </div>

        {/* Middle: the one editorial moment per page */}
        <div className="flex-1 flex flex-col justify-center py-12 md:py-0">
          <p
            className="mono"
            style={{
              fontSize: 9,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 18,
            }}
          >
            FY 2026 · Internal use
          </p>
          <h1
            className="display"
            style={{
              fontSize: "clamp(2.25rem, 4.2vw, 3.5rem)",
              lineHeight: 1.05,
              color: "var(--white)",
              marginBottom: 24,
              maxWidth: "14ch",
            }}
          >
            Every invoice.<br />
            Every vendor.<br />
            <span style={{ color: "var(--amber)" }}>Every rupee,</span><br />
            accounted&nbsp;for.
          </h1>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--muted)",
              maxWidth: "42ch",
            }}
          >
            BuildCo Infra&apos;s internal ledger for vendor invoices.
            Drop a PDF; the system reads it, your accountant ships it,
            the audit trail keeps itself.
          </p>
        </div>

        {/* Bottom: footnote rule with metadata */}
        <div
          className="mono flex items-center gap-4 pt-6"
          style={{
            borderTop: "1px solid var(--border)",
            fontSize: 9.5,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          <span>v0.1 demo</span>
          <span aria-hidden style={{ width: 1, height: 10, background: "var(--border2)" }} />
          <span>2 active roles</span>
          <span aria-hidden style={{ width: 1, height: 10, background: "var(--border2)" }} />
          <span>Auth.js v5</span>
        </div>
      </aside>

      {/* ─── Form panel ─── */}
      <section className="flex items-center px-6 py-12 md:px-14 md:py-16">
        <div className="w-full max-w-[360px] mx-auto md:mx-0">
          {/* Section heading */}
          <div className="flex items-baseline gap-3 mb-10">
            <span
              className="mono"
              style={{
                fontSize: 9,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              § Access
            </span>
            <span aria-hidden style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          <h2
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: "var(--white)",
              marginBottom: 6,
              letterSpacing: "-0.01em",
            }}
          >
            Sign in
          </h2>
          <p
            style={{
              fontSize: 12.5,
              color: "var(--muted)",
              lineHeight: 1.55,
              marginBottom: 28,
            }}
          >
            Pick a demo role to skip straight in, or sign in with email below.
          </p>

          {/* Quick-login chips — primary path for the demo */}
          <div className="space-y-2.5 mb-8">
            <form action={quickLoginAccountant}>
              <button
                type="submit"
                className="role-chip"
                aria-label="Sign in as accountant"
              >
                <span className="role-chip-dot" style={{ background: "var(--blue)" }} />
                <span className="role-chip-name">Accountant</span>
                <span className="role-chip-meta mono">read · write · upload</span>
                <span className="role-chip-arrow mono">→</span>
              </button>
            </form>
            <form action={quickLoginViewer}>
              <button
                type="submit"
                className="role-chip"
                aria-label="Sign in as viewer"
              >
                <span className="role-chip-dot" style={{ background: "var(--green)" }} />
                <span className="role-chip-name">Viewer</span>
                <span className="role-chip-meta mono">read only</span>
                <span className="role-chip-arrow mono">→</span>
              </button>
            </form>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span
              className="mono"
              style={{
                fontSize: 8.5,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              or
            </span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          {/* Manual login */}
          <form action={loginAction} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mono"
                style={{
                  display: "block",
                  fontSize: 9,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  marginBottom: 6,
                }}
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@buildco.in"
                className="login-input"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mono"
                style={{
                  display: "block",
                  fontSize: 9,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  marginBottom: 6,
                }}
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="•••••••"
                className="login-input"
              />
            </div>

            {error && (
              <div
                className="mono"
                role="alert"
                style={{
                  fontSize: 11,
                  padding: "8px 12px",
                  border: "1px solid color-mix(in srgb, var(--red) 50%, transparent)",
                  background: "color-mix(in srgb, var(--red) 8%, transparent)",
                  color: "var(--red)",
                  borderRadius: 2,
                  letterSpacing: "0.02em",
                }}
              >
                {error}
              </div>
            )}

            <button type="submit" className="login-submit">
              <span>Sign in</span>
              <span aria-hidden className="mono" style={{ opacity: 0.7 }}>↩</span>
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
