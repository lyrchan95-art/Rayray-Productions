import { redirect } from "next/navigation";
import { currentUser, devLoginEnabled, googleEnabled, signIn } from "@/lib/auth";

export const metadata = { title: "Sign in · Idea2Proto" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const u = await currentUser();
  if (u) redirect(u.picsAcceptedAt ? "/" : "/welcome");
  const { sent, error } = await searchParams;

  async function emailAction(form: FormData) {
    "use server";
    await signIn("nodemailer", { email: String(form.get("email") || ""), redirectTo: "/welcome" });
  }
  async function googleAction() {
    "use server";
    await signIn("google", { redirectTo: "/welcome" });
  }
  async function devAction() {
    "use server";
    await signIn("dev", { email: "founder@dev.local", redirectTo: "/welcome" });
  }

  return (
    <main className="narrow" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <p className="brand" style={{ marginBottom: 32 }}>Idea2Proto<span className="brand-dot">.</span></p>
      <h1>講出 idea，一分鐘有原型。</h1>
      <p className="muted" style={{ marginTop: 0 }}>Say your idea. Get a shareable prototype in under a minute.</p>

      {sent ? (
        <div className="card" role="status" style={{ marginTop: 24 }}>
          <strong>查下你個 email 📬</strong>
          <p className="muted" style={{ marginBottom: 0 }}>Check your inbox for a sign-in link.</p>
        </div>
      ) : (
        <div style={{ marginTop: 24 }}>
          {error && <p className="error" role="alert">登入失敗，請再試。Sign-in failed — please try again.</p>}
          {googleEnabled && (
            <>
              <form action={googleAction}>
                <button className="btn btn-lg btn-block" type="submit">Continue with Google</button>
              </form>
              <div className="divider">or</div>
            </>
          )}
          <form action={emailAction}>
            <div className="field">
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" className="input" placeholder="you@example.com" />
            </div>
            <button className="btn btn-primary btn-lg btn-block" type="submit">寄登入連結 · Email me a link</button>
          </form>
          {devLoginEnabled && (
            <form action={devAction} style={{ marginTop: 12 }}>
              <button className="btn btn-ghost btn-block" type="submit">Dev login (local only)</button>
            </form>
          )}
        </div>
      )}
    </main>
  );
}
