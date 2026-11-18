import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { now, run } from "@/lib/db";

export const metadata = { title: "Privacy notice · Idea2Proto" };

/** PDPO Personal Information Collection Statement — must be accepted before first use. */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const u = await currentUser();
  if (!u) redirect("/signin");
  const { view } = await searchParams;
  const viewOnly = !!view && !!u.picsAcceptedAt;
  if (u.picsAcceptedAt && !viewOnly) redirect("/");

  async function accept(form: FormData) {
    "use server";
    const me = await currentUser();
    if (!me) redirect("/signin");
    run(`UPDATE users SET pics_accepted_at=?, training_opt_in=? WHERE id=?`, now(), form.get("training") === "on" ? 1 : 0, me.id);
    redirect("/");
  }

  return (
    <main className="narrow">
      <h1>收集個人資料聲明</h1>
      <p className="muted" style={{ marginTop: 0 }}>Personal Information Collection Statement (PDPO, Cap. 486)</p>
      <div className="pics" tabIndex={0} aria-label="Privacy statement">
        <h3>1. 我哋收集咩 · What we collect</h3>
        <p>電郵、名稱、你輸入嘅文字、錄音（轉文字後即棄）、相片、生成嘅原型同對話紀錄、用量數據。<br />Email, name, text you enter, voice recordings (discarded after transcription), photos, generated prototypes and conversations, usage data.</p>
        <h3>2. 用途 · Purpose</h3>
        <p>提供同改善服務、處理付款、防止濫用、同你聯絡有關你嘅帳戶。<br />To provide the service, process payments, prevent abuse, and contact you about your account.</p>
        <h3>3. 轉移 · Transfers</h3>
        <p>你嘅內容會傳送畀 AI 模型供應商（智譜 GLM、DeepSeek）處理，伺服器可能位於香港以外（包括中國內地）。付款由 Stripe 處理。<br />Your content is sent to AI model providers (Zhipu GLM, DeepSeek) for processing; servers may be outside Hong Kong, including Mainland China. Payments are processed by Stripe.</p>
        <h3>4. 模型訓練 · Model training</h3>
        <p>除非你喺下面揀選，否則我哋唔會用你嘅內容訓練或改善模型。<br />We will not use your content to train or improve models unless you opt in below.</p>
        <h3>5. 你嘅權利 · Your rights</h3>
        <p>你可以隨時喺設定查閱、匯出、更正或刪除你嘅資料同帳戶。<br />You can access, export, correct or delete your data and account at any time in Settings.</p>
        <h3>6. 保留 · Retention</h3>
        <p>資料保留至你刪除帳戶；已發佈連結可隨時收回。<br />Data is kept until you delete your account; published links can be revoked at any time.</p>
      </div>
      {viewOnly ? (
        <Link className="btn btn-block" href="/settings">← Back</Link>
      ) : (
        <form action={accept}>
          <label style={{ display: "flex", gap: 12, alignItems: "flex-start", margin: "16px 0 24px", fontSize: "var(--text-sm)" }}>
            <input type="checkbox" name="training" style={{ width: 22, height: 22, marginTop: 2, flexShrink: 0 }} />
            <span>（選擇性）准許用我嘅內容改善模型。<br /><span className="muted">(Optional) Allow my content to be used to improve models.</span></span>
          </label>
          <button className="btn btn-primary btn-lg btn-block" type="submit">我同意並繼續 · I agree, continue</button>
        </form>
      )}
    </main>
  );
}
