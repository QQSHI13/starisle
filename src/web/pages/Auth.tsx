import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLang } from "../i18n";
import { api } from "../api";
import { useMe } from "../App";

function AuthSwitch({ active }: { active: "login" | "apply" }) {
  const { t } = useLang();
  return (
    <div className="switch" role="tablist">
      <Link to="/login" role="tab" aria-selected={active === "login"} className={active === "login" ? "active" : ""}>{t.login_title}</Link>
      <Link to="/apply" role="tab" aria-selected={active === "apply"} className={active === "apply" ? "active" : ""}>{t.apply_title}</Link>
    </div>
  );
}

function Field({ label, hint, ...props }: any) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Apply() {
  const { t } = useLang();
  const [f, setF] = useState({ username: "", password: "", display_name: "", email: "", statement: "", age: "", guardian_name: "", guardian_contact: "" });
  const [c1, setC1] = useState(false);
  const [otpMsg, setOtpMsg] = useState<string | null>(null);
  const [c2, setC2] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    try {
      const d = await api("/auth/register", { method: "POST", body: JSON.stringify({ ...f, consent_privacy: c1, consent_public: c2 }) });
      setToken(d.token);
    } catch (e: any) { setErr(String(e.message)); }
  };
  return (
    <div className="form-page">
      <AuthSwitch active="apply" />
      <h1>{t.apply_title}</h1>
      <p className="sub">{t.apply_sub}</p>
      {token ? (
        <>
          <div className="notice" role="status"><b>{t.apply_query}</b><br />{t.apply_token_hint}<br /><code>{token}</code></div>
          <Link className="btn" to="/apply/query">{t.apply_query}</Link>
        </>
      ) : (
        <form onSubmit={submit}>
          {err && <div className="error-box" role="alert">{err}</div>}
          <Field label={t.username} hint={t.username_hint} type="text" required value={f.username} onChange={set("username")} autoComplete="username" />
          <Field label={t.password} type="password" required minLength={8} maxLength={72} value={f.password} onChange={set("password")} autoComplete="new-password" />
          <Field label={t.display_name} hint={t.display_name_hint} type="text" required value={f.display_name} onChange={set("display_name")} />
          <Field label={t.email} type="email" required value={f.email} onChange={set("email")} />
          <label className="field"><span>{t.statement}</span>
            <textarea rows={4} required minLength={10} value={f.statement} onChange={set("statement")} /></label>
          <label className="check"><input type="checkbox" checked={c1} onChange={(e: any) => setC1(e.target.checked)} required /><span>{t.consent_privacy}</span></label>
          <label className="check"><input type="checkbox" checked={c2} onChange={(e: any) => setC2(e.target.checked)} required /><span>{t.consent_public}</span></label>
          <button className="btn primary" type="submit">{t.apply_submit}</button>
        </form>
      )}
    </div>
  );
}

export function ApplyQuery() {
  const { t } = useLang();
  const [f, setF] = useState({ username: "", password: "" });
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null); setResult(null);
    try { setResult(await api("/auth/application/status", { method: "POST", body: JSON.stringify(f) })); }
    catch (e: any) { setErr(String(e.message)); }
  };
  const statusLabel: Record<string, string> = { pending: t.status_pending, approved: t.status_approved, rejected: t.status_rejected };
  return (
    <div className="form-page">
      <h1>{t.apply_query}</h1>
      <p className="sub">{t.query_hint}</p>
      <form onSubmit={submit}>
        {err && <div className="error-box" role="alert">{err}</div>}
        <Field label={t.username} type="text" required value={f.username} onChange={(e: any) => setF({ ...f, username: e.target.value })} autoComplete="username" />
        <Field label={t.password} type="password" required value={f.password} onChange={(e: any) => setF({ ...f, password: e.target.value })} autoComplete="current-password" />
        <button className="btn primary" type="submit">{t.apply_query}</button>
      </form>
      {result && (
        <div className="notice" role="status">
          {statusLabel[result.status] ?? result.status}
          {result.reason && <><br />{result.reason}</>}
        </div>
      )}
    </div>
  );
}

export function Login() {
  const { t } = useLang();
  const nav = useNavigate();
  const { refresh } = useMe();
  const [f, setF] = useState({ username: "", password: "" });
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    try {
      await api("/auth/login", { method: "POST", body: JSON.stringify(f) });
      await refresh();
      nav("/me");
    } catch (e: any) { setErr(String(e.message)); }
  };
  return (
    <div className="form-page">
      <AuthSwitch active="login" />
      <h1>{t.login_title}</h1>
      <p className="sub">{t.login_sub}</p>
      <form onSubmit={submit}>
        {err && <div className="error-box" role="alert">{err}</div>}
        <Field label={t.username} type="text" required autoComplete="username" value={f.username} onChange={(e: any) => setF({ ...f, username: e.target.value })} />
        <Field label={t.password} type="password" required autoComplete="current-password" value={f.password} onChange={(e: any) => setF({ ...f, password: e.target.value })} />
        <button className="btn primary" type="submit">{t.login}</button>
        <Link className="btn" style={{ marginLeft: 10 }} to="/account-recovery">{t.recovery}</Link>
      </form>
    </div>
  );
}

function EmailReset() {
  const { lang } = useLang();
  const [f, setF] = useState({ email: "", code: "", password: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  return (
    <form onSubmit={async (e) => { e.preventDefault(); setMsg(null);
      try { await api("/auth/recover-email", { method: "POST", body: JSON.stringify(f) }); setOk(true); }
      catch (e2: any) { setMsg(String(e2.message)); } }}>
      {msg && <div className="error-box" role="alert">{msg}</div>}
      {ok ? <div className="notice" role="status">{lang === "zh" ? "密码已重置，请用新密码登录。" : "Password reset — sign in with your new password."}</div> : (<>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input type="email" required placeholder={lang === "zh" ? "注册邮箱" : "Email"} value={f.email} onChange={(e: any) => setF({ ...f, email: e.target.value })} style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={async () => { setMsg(null);
            try { const d = await api("/auth/email-otp", { method: "POST", body: JSON.stringify({ email: f.email, purpose: "reset" }) });
              setMsg((lang === "zh" ? "验证码已发送" : "Code sent") + (d.dev ? `（开发模式：${d.dev}）` : ""));
            } catch (e2: any) { setMsg(String(e2.message)); } }}>{lang === "zh" ? "发送验证码" : "Send code"}</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input type="text" required inputMode="numeric" placeholder={lang === "zh" ? "6 位验证码" : "6-digit code"} value={f.code} onChange={(e: any) => setF({ ...f, code: e.target.value })} />
          <input type="password" required minLength={8} maxLength={72} placeholder={lang === "zh" ? "新密码（8–72 位）" : "New password"} value={f.password} onChange={(e: any) => setF({ ...f, password: e.target.value })} />
        </div>
        <button className="btn primary" style={{ marginTop: 10 }}>{lang === "zh" ? "重置密码" : "Reset password"}</button>
      </>)}
    </form>
  );
}

export function Recovery() {
  const { t, lang } = useLang();
  const { me } = useMe();
  const [pw, setPw] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [f, setF] = useState({ username: "", code: "", password: "" });
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const gen = async () => {
    setErr(null);
    try { const d = await api("/auth/recovery-code", { method: "POST", body: JSON.stringify({ password: pw }) }); setCode(d.code); }
    catch (e: any) { setErr(String(e.message)); }
  };
  const reset = async (e: FormEvent) => {
    e.preventDefault(); setErr(null); setOk(false);
    try { await api("/auth/recover", { method: "POST", body: JSON.stringify(f) }); setOk(true); }
    catch (e: any) { setErr(String(e.message)); }
  };
  return (
    <div className="form-page">
      <h1>{t.recovery}</h1>
      <p className="sub">{t.recovery_sub}</p>
      {err && <div className="error-box" role="alert">{err}</div>}
      {me && (
        <>
          <h3>{t.gen_code}</h3>
          <p className="dim">{t.gen_code_sub}</p>
          {code ? (
            <div className="notice" role="status"><code>{code}</code></div>
          ) : (
            <div className="toolbar">
              <input type="password" placeholder={t.password} value={pw} onChange={(e: any) => setPw(e.target.value)} style={{ width: 220 }} />
              <button className="btn" onClick={gen}>{t.gen_code}</button>
            </div>
          )}
        </>
      )}
      <h3 style={{ marginTop: 36 }}>{lang === "zh" ? "邮箱验证码重置" : "Reset via email code"}</h3>
      <EmailReset />
      <h3 style={{ marginTop: 36 }}>{t.use_code}</h3>
      <form onSubmit={reset}>
        <Field label={t.username} type="text" required value={f.username} onChange={(e: any) => setF({ ...f, username: e.target.value })} />
        <Field label={t.recovery} type="text" required value={f.code} onChange={(e: any) => setF({ ...f, code: e.target.value })} />
        <Field label={t.new_password} type="password" required minLength={8} maxLength={72} value={f.password} onChange={(e: any) => setF({ ...f, password: e.target.value })} />
        <button className="btn primary" type="submit">{t.reset_password}</button>
      </form>
      {ok && <div className="notice" role="status">OK</div>}
    </div>
  );
}
