import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect(`/login?error=${encodeURIComponent("Invalid email or password")}`);
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
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-amber" />
          <span className="mono text-[11px] tracking-[0.12em] uppercase text-amber">
            BuildCo Infra · PO Automation
          </span>
        </div>

        <h1 className="text-xl font-medium mb-1">Sign in</h1>
        <p className="text-muted text-xs mb-6">
          Demo accounts seeded. Try{" "}
          <span className="mono text-fg">admin@buildco.in / admin123</span>
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
              className="w-full bg-off border border-border-2 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-amber"
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
              className="w-full bg-off border border-border-2 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-amber"
            />
          </div>

          {error && (
            <div className="badge badge-err w-full justify-center">{error}</div>
          )}

          <button
            type="submit"
            className="w-full bg-amber text-bg font-medium py-2 rounded-sm hover:opacity-90 transition mono text-[11px] tracking-[0.12em] uppercase"
          >
            Sign in
          </button>
        </form>

        <div className="mt-6 border-t border-border pt-4 mono text-[10px] text-muted leading-relaxed">
          <div className="mb-1 tracking-[0.12em] uppercase">Seeded users</div>
          <div>admin@buildco.in · admin123</div>
          <div>accountant@buildco.in · accountant123</div>
          <div>viewer@buildco.in · viewer123</div>
        </div>
      </div>
    </main>
  );
}
