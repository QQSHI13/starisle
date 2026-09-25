import { Link } from "react-router-dom";
import { useState } from "react";
import { Editor } from "../Editor";
import { I } from "../icons";
import { Modal } from "../Modal";
import { useToast } from "../toast";
import { Md } from "../Md";
import { useLang } from "../i18n";
import { api } from "../api";
import { useMe } from "../App";
import { useFetch } from "../hooks";

export default function Admin() {
  const { t } = useLang();
  const { me } = useMe();
  const { data: apps, refresh } = useFetchData<any[]>("/admin/applications", me?.role === "admin");
  const { data: projs, refresh: refreshP } = useFetchData<any[]>("/admin/projects", me?.role === "admin");
  const { data: enrolls, refresh: refreshE } = useFetchData<any[]>("/admin/enrollments", me?.role === "admin");

  if (me?.role !== "admin") return <div className="err-full">403</div>;

  const decide = async (path: string, id: number, action: string, reason?: string) => {
    await api(`${path}/${id}`, { method: "POST", body: JSON.stringify({ action, reason }) });
    refresh(); refreshP(); refreshE();
  };

  return (
    <div className="wrap" style={{ padding: "64px 24px" }}>
      <h1 className="serif" style={{ fontSize: 32 }}>{t.admin}</h1>
      <Overview />

      <section style={{ padding: "28px 0" }}>
        <h3>{t.admin_apps}</h3>
        <table className="list">
          <thead><tr><th>{t.username}</th><th>{t.display_name}</th><th>{t.email}</th><th>Statement</th><th></th></tr></thead>
          <tbody>
            {(apps ?? []).filter((a: any) => a.status === "pending") .map((a: any) => (
              <tr key={a.id}>
                <td>{a.username}</td><td>{a.display_name}</td><td>{a.email}</td>
                <td className="dim" style={{ maxWidth: 320 }}>{a.statement}
                  <span style={{ display: "block", marginTop: 4 }}>
                    {a.email_verified ? <span className="pill gold">邮箱已验证</span> : <span className="pill">邮箱未验证</span>}{" "}
                    {!!a.is_minor && <span className="pill gold">未成年{a.guardian_name ? ` · 监护人:${a.guardian_name}` : ""}</span>}
                  </span>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn small primary" onClick={() => decide("/admin/applications", a.id, "approve")}>{t.approve}</button>{" "}
                  <Reject onOk={(reason) => decide("/admin/applications", a.id, "reject", reason)} label={t.reject} />{" "}
                  <DeleteBtn label="删除" title="删除申请记录" warn="仅删除这条申请记录，不影响对应成员账号。" onConfirm={async () => { await api(`/admin/applications/${a.id}`, { method: "DELETE" }); refresh(); }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {apps && !apps.some((a: any) => a.status === "pending") && <p className="dim">{t.no_items}</p>}
      </section>

      <section style={{ padding: "0 0 28px" }}>
        <h3>{t.admin_projects}</h3>
        {(projs ?? []) .map((p: any) => (
          <div className="member-row" key={p.id}>
            <span className="dname" style={{ fontSize: 15 }}>{p.name}</span>
            <span className="bio">{p.owner_username} — {p.tagline}</span>
            <button className="btn small primary" onClick={() => decide("/admin/projects", p.id, "approve")}>{t.approve}</button>{" "}
            <Reject onOk={(reason) => decide("/admin/projects", p.id, "reject", reason)} label={t.reject} />
          </div>
        ))}
        {projs && projs.length === 0 && <p className="dim">{t.no_items}</p>}
      </section>

      <UpdatesQueue />
      <ReportsQueue />
      <MembersAdmin />
      <CommentsQueue />
      <ColumnsAdmin />
      <MentorQueue />
      <AuditLog />
      <CourseTools />
      <GradingQueue />
      <AdminTools />
      <section style={{ padding: "0 0 28px" }}>
        <h3>{t.admin_enroll}</h3>
        {(enrolls ?? []) .map((e: any) => (
          <div className="member-row" key={e.id}>
            <span className="dname" style={{ fontSize: 15 }}>{e.display_name ?? e.username}</span>
            <span className="bio">{e.title}</span>
            <button className="btn small primary" onClick={() => decide("/admin/enrollments", e.id, "approve")}>{t.approve}</button>{" "}
            <button className="btn small danger" onClick={() => decide("/admin/enrollments", e.id, "reject")}>{t.reject}</button>
          </div>
        ))}
        {enrolls && enrolls.length === 0 && <p className="dim">{t.no_items}</p>}
      </section>
    </div>
  );
}

function useFetchData<T>(path: string | null, enabled: boolean) {
  const [tick, setTick] = useState(0);
  const res = useFetch<{ [k: string]: T }>(enabled && path ? path : null, [tick, enabled]);
  const key = path?.split("/").pop() ?? "";
  return { data: res.data ? (res.data as any)[key === "applications" ? "applications" : key === "projects" ? "projects" : "enrollments"] : null, refresh: () => setTick(tick + 1) };
}

function Overview() {
  const { data } = useFetch<any>("/admin/overview", []);
  if (!data) return null;
  const items = [
    ["待审申请", data.pending_applications], ["待审项目", data.pending_projects], ["待审动态", data.pending_updates],
    ["待审评论", data.pending_comments], ["待处理举报", data.pending_reports], ["待对接导师", data.pending_mentors],
    ["待批改作业", data.pending_submissions], ["成员", data.members], ["未成年成员", data.minors], ["上线项目", data.projects],
  ] as const;
  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", margin: "24px 0 40px" }}>
      {items.map(([label, n]) => (
        <div key={label} className="card" style={{ padding: "16px 18px", gap: 4 }}>
          <b className="serif" style={{ fontSize: 30, lineHeight: 1, color: n > 0 && label.startsWith("待") ? "var(--gold)" : "var(--ink)" }}>{n}</b>
          <span className="dim" style={{ fontSize: 12.5 }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function UpdatesQueue() {
  const [tick, setTick] = useState(0);
  const { data } = useFetch<{ updates: any[] }>("/admin/updates", [tick]);
  const items = data?.updates ?? [];
  const decide = async (id: number, action: string) => { await api(`/admin/updates/${id}`, { method: "POST", body: JSON.stringify({ action }) }); setTick((x) => x + 1); };
  if (items.length === 0) return null;
  return (
    <section style={{ padding: "0 0 28px" }}>
      <h3 style={{display:"flex",alignItems:"center",gap:8}}><I name="file" size={17} /> 动态审核 · Update review</h3>
      {items.map((u: any) => (
        <div className="member-row" key={u.id}>
          <span className="bio" style={{ flex: 1 }}><b>{u.author}</b> @ {u.project_name}:{u.text}</span>
          <button className="btn small primary" onClick={() => decide(u.id, "approve")}>通过</button>{" "}
          <button className="btn small danger" onClick={() => decide(u.id, "reject")}>拒绝</button>
        </div>
      ))}
    </section>
  );
}

function ReportsQueue() {
  const [tick, setTick] = useState(0);
  const { data } = useFetch<{ reports: any[] }>("/admin/reports", [tick]);
  const items = (data?.reports ?? []).filter((r: any) => r.status === "pending");
  const decide = async (id: number, action: string) => { await api(`/admin/reports/${id}`, { method: "POST", body: JSON.stringify({ action }) }); setTick((x) => x + 1); };
  return (
    <section style={{ padding: "0 0 28px" }}>
      <h3 style={{display:"flex",alignItems:"center",gap:8}}><I name="shield" size={17} /> 举报队列 · Reports</h3>
      {items.length === 0 && <p className="dim">没有待处理的举报。</p>}
      {items.map((r: any) => (
        <div className="member-row" key={r.id}>
          <span className="bio" style={{ flex: 1 }}>{r.reporter} 举报了 {r.target_type} #{r.target_id}{r.reason ? ` — ${r.reason}` : ""}</span>
          <button className="btn small danger" onClick={() => decide(r.id, "uphold")}>属实并下架</button>{" "}
          <button className="btn small" onClick={() => decide(r.id, "dismiss")}>驳回</button>
        </div>
      ))}
    </section>
  );
}

function AuditLog() {
  const { data } = useFetch<{ entries: any[] }>("/admin/audit", []);
  const items = data?.entries ?? [];
  if (items.length === 0) return null;
  return (
    <section style={{ padding: "0 0 28px" }}>
      <h3>审计日志 · Audit log</h3>
      {items.slice(0, 20).map((a: any) => (
        <div className="member-row" key={a.id}>
          <span className="pill">{a.action}</span>
          <span className="bio" style={{ flex: 1 }}>{a.actor ?? "system"} — {a.detail}</span>
          <span className="bio">{a.created_at.slice(0, 16)}</span>
        </div>
      ))}
    </section>
  );
}

function MembersAdmin() {
  const [q, setQ] = useState("");
  const [tick, setTick] = useState(0);
  const { data } = useFetch<{ members: any[] }>("/admin/members", [tick]);
  const members = (data?.members ?? []).filter((m: any) =>
    !q.trim() || (m.username + m.display_name + (m.email ?? "")).toLowerCase().includes(q.trim().toLowerCase()));
  const verify = async (id: number) => { await api(`/admin/members/${id}/verify`, { method: "POST", body: "{}" }); setTick((x) => x + 1); };
  return (
    <section style={{ padding: "0 0 28px" }}>
      <h3 style={{display:"flex",alignItems:"center",gap:8}}><I name="shield" size={17} /> 成员管理 · Members</h3>
      <div className="toolbar"><input type="text" placeholder="搜索真实姓名 / 网名 / 邮箱…" value={q} onChange={(e: any) => setQ(e.target.value)} style={{ width: 280 }} /></div>
      <table className="list">
        <thead><tr><th>真实姓名</th><th>网名</th><th>邮箱</th><th>项目</th><th>标记</th><th></th></tr></thead>
        <tbody>
          {members.map((m: any) => (
            <tr key={m.id}>
              <td>{m.username}{m.status !== "active" && <span className="pill" style={{ marginLeft: 6 }}>{m.status}</span>}</td>
              <td>{m.display_name}</td>
              <td className="dim">{m.email}</td>
              <td>{m.project_count}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                {!!m.is_minor && <span className="pill gold">未成年</span>}{" "}
                {!!m.is_minor && m.guardian_name && <span className="pill" title={m.guardian_contact}>{m.guardian_name}</span>}{" "}
                {!!m.verified && <span className="pill gold">已认证</span>}
              </td>
              <td style={{ whiteSpace: "nowrap" }}>
                <button className="btn small" onClick={() => verify(m.id)}>{m.verified ? "取消认证" : "认证"}</button>{" "}
                <RoleModal m={m} onSaved={() => setTick((x) => x + 1)} />{" "}
                <button className="btn small danger" onClick={async () => { await api(`/admin/members/${m.id}/status`, { method: "POST", body: JSON.stringify({ status: m.status === "active" ? "deactivated" : "active" }) }); setTick((x) => x + 1); }}>{m.status === "active" ? "停用" : "启用"}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CommentsQueue() {
  const [tick, setTick] = useState(0);
  const { data } = useFetch<{ comments: any[] }>("/admin/comments", [tick]);
  const items = data?.comments ?? [];
  const decide = async (id: number, action: string) => { await api(`/admin/comments/${id}`, { method: "POST", body: JSON.stringify({ action }) }); setTick((x) => x + 1); };
  if (items.length === 0) return null;
  return (
    <section style={{ padding: "0 0 28px" }}>
      <h3 style={{display:"flex",alignItems:"center",gap:8}}><I name="message" size={17} /> 评论审核 · Comments ({items.length})</h3>
      {items.map((cm: any) => (
        <div className="member-row" key={cm.id}>
          <span className="bio" style={{ flex: 1 }}><b>{cm.author}</b> 在《{cm.column_title}》:{cm.text}</span>
          <button className="btn small primary" onClick={() => decide(cm.id, "approve")}>通过</button>{" "}
          <button className="btn small danger" onClick={() => decide(cm.id, "reject")}>拒绝</button>
        </div>
      ))}
    </section>
  );
}

function ColumnsAdmin() {
  const [tick, setTick] = useState(0);
  const { data } = useFetch<{ columns: any[] }>("/columns", [tick]);
  const items = data?.columns ?? [];
  return (
    <section style={{ padding: "0 0 28px" }}>
      <h3>专栏管理 · Columns</h3>
      {items.map((col: any) => (
        <div className="member-row" key={col.id}>
          <span className="dname" style={{ fontSize: 15 }}>{col.title}</span>
          <span className="bio">{col.column_label} · {col.author}</span>
          <Link className="btn small" to={`/columns/${col.slug}`} target="_blank">查看</Link>{" "}
          <ColumnEditor id={col.id} title={col.title} subtitle={col.subtitle ?? ""} existing={{ title: col.title, subtitle: col.subtitle ?? "", slug: col.slug }} onSaved={() => setTick((x) => x + 1)} />
          <button className="btn small danger" onClick={async () => { { await api(`/admin/columns/${col.id}`, { method: "DELETE" }); setTick((x) => x + 1); } }}>删除</button>
        </div>
      ))}
    </section>
  );
}

function ColumnEditor({ id, onSaved, existing }: { id: number; title: string; subtitle: string; existing: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const openIt = async () => {
    if (!open && !text) {
      setLoading(true);
      const d: any = await fetch(`/api/columns/${(existing as any).slug ?? ""}`).then((r) => r.json()).catch(() => null);
      setText(d?.column?.text ?? "");
      setLoading(false);
    }
    setOpen(!open);
  };
  return (
    <span>
      <button className="btn small" onClick={openIt}>编辑</button>
      {open && (
        <div style={{ width: "100%", marginTop: 10, border: "1px solid var(--line)", borderRadius: 8, padding: 16 }}>
          {loading ? <p className="dim">载入中…</p> : (<>
            <Editor value={text} onChange={setText} rows={10} />
            <button className="btn small primary" onClick={async () => {
              await api(`/admin/columns/${id}`, { method: "PUT", body: JSON.stringify({ text }) });
              onSaved(); setOpen(false);
            }}>保存</button>{" "}
            <button className="btn small" onClick={() => setOpen(false)}>取消</button>
          </>)}
        </div>
      )}
    </span>
  );
}

function MentorQueue() {
  const { t } = useLang();
  const [tick, setTick] = useState(0);
  const { data } = useFetch<{ requests: any[] }>("/admin/mentor-requests", [tick]);
  const reqs = (data?.requests ?? []).filter((r: any) => r.status === "pending");
  const decide = async (id: number, action: string) => {
    await api(`/admin/mentor-requests/${id}`, { method: "POST", body: JSON.stringify({ action }) });
    setTick((x) => x + 1);
  };
  return (
    <section style={{ padding: "0 0 28px" }}>
      <h3 style={{display:"flex",alignItems:"center",gap:8}}><I name="cap" size={17} /> 指导申请 · Mentor requests</h3>
      {reqs.length === 0 && <p className="dim">{t.no_items}</p>}
      {reqs.map((r: any) => (
        <div className="member-row" key={r.id}>
          <span className="dname" style={{ fontSize: 15 }}>{r.member_name}</span>
          <span className="bio">{r.member_username ? `(${r.member_username}) ` : ""}想跟 {r.mentor_name} 做:{r.interest}{r.questions ? ` · 问:${r.questions}` : ""}</span>
          <button className="btn small primary" onClick={() => decide(r.id, "approve")}>通过</button>{" "}
          <button className="btn small" onClick={() => decide(r.id, "contacted")}>已对接</button>{" "}
          <button className="btn small danger" onClick={() => decide(r.id, "reject")}>{t.reject}</button>
        </div>
      ))}
    </section>
  );
}

function CourseTools() {
  const [tick, setTick] = useState(0);
  const { data: courseData } = useFetch<{ courses: any[] }>("/courses", [tick]);
  const [courseSlug, setCourseSlug] = useState("");
  const [ltitle, setLtitle] = useState(""); const [lsummary, setLsummary] = useState(""); const [lcontent, setLcontent] = useState("");
  const [lessonId, setLessonId] = useState(""); const [htitle, setHtitle] = useState(""); const [hdue, setHdue] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <section style={{ padding: "0 0 28px" }}>
      <h3 style={{display:"flex",alignItems:"center",gap:8}}><I name="book" size={17} /> 课程与作业 · Courses & homework</h3>
      {msg && <div className="notice" role="status">{msg}</div>}
      <div className="toolbar">
        <select value={courseSlug} onChange={(e: any) => setCourseSlug(e.target.value)} style={{ width: "auto" }}>
          <option value="">选择课程…</option>
          {(courseData?.courses ?? []).map((c: any) => <option key={c.slug} value={c.slug}>{c.title}</option>)}
        </select>
      </div>
      {courseSlug && (
        <>
          <form className="toolbar" onSubmit={async (e) => { e.preventDefault(); setMsg(null);
            try { await api(`/admin/courses/${courseSlug}/lessons`, { method: "POST", body: JSON.stringify({ title: ltitle, summary: lsummary, content: lcontent }) }); setLtitle(""); setLsummary(""); setLcontent(""); setMsg("课时已添加"); } catch (e2: any) { setMsg(String(e2.message)); } }}>
            <input type="text" required placeholder="课节标题" value={ltitle} onChange={(e: any) => setLtitle(e.target.value)} style={{ width: 160 }} />
            <input type="text" placeholder="摘要" value={lsummary} onChange={(e: any) => setLsummary(e.target.value)} style={{ width: 160 }} />
            <input type="text" placeholder="内容（对已开通成员可见）" value={lcontent} onChange={(e: any) => setLcontent(e.target.value)} style={{ width: 260 }} />
            <button className="btn small primary">添加课节</button>
          </form>
          <form className="toolbar" onSubmit={async (e) => { e.preventDefault(); setMsg(null);
            try { await api(`/admin/lessons/${lessonId}/homework`, { method: "POST", body: JSON.stringify({ title: htitle, due_at: hdue }) }); setHtitle(""); setMsg("作业已布置"); } catch (e2: any) { setMsg(String(e2.message)); } }}>
            <input type="number" required placeholder="课节 ID" value={lessonId} onChange={(e: any) => setLessonId(e.target.value)} style={{ width: 100 }} />
            <input type="text" required placeholder="作业标题" value={htitle} onChange={(e: any) => setHtitle(e.target.value)} style={{ width: 200 }} />
            <input type="text" placeholder="截止时间 2026-10-01 20:00" value={hdue} onChange={(e: any) => setHdue(e.target.value)} style={{ width: 200 }} />
            <button className="btn small primary">布置作业</button>
          </form>
          <LessonList slug={courseSlug} />
        </>
      )}
    </section>
  );
}

function LessonList({ slug }: { slug: string }) {
  const { data: cd } = useFetch<{ lessons: any[] }>(`/courses/${slug}`, [slug]);
  return (
    <div>
      {(cd?.lessons ?? []).map((l: any) => (
        <div className="member-row" key={l.id}>
          <span className="pill">#{l.id}</span>
          <span className="bio" style={{ flex: 1 }}>{l.title}{l.summary ? ` — ${l.summary}` : ""}</span>
          <button className="btn small danger" onClick={async () => { { await api(`/admin/lessons/${l.id}`, { method: "DELETE" }); location.reload(); } }}>删除</button>
        </div>
      ))}
    </div>
  );
}

function GradingQueue() {
  const [tick, setTick] = useState(0);
  const { data } = useFetch<{ submissions: any[] }>("/admin/submissions", [tick]);
  const items = (data?.submissions ?? []).filter((s: any) => s.status === "pending");
  const [grade, setGrade] = useState<{ id: number; action: string } | null>(null);
  const [feedback, setFeedback] = useState("");
  const doGrade = async () => {
    if (!grade) return;
    await api(`/admin/submissions/${grade.id}`, { method: "POST", body: JSON.stringify({ action: grade.action, feedback }) });
    setGrade(null); setFeedback(""); setTick((x) => x + 1);
  };
  if (items.length === 0) return null;
  return (
    <section style={{ padding: "0 0 28px" }}>
      <h3 style={{display:"flex",alignItems:"center",gap:8}}><I name="check" size={17} /> 作业批改 · Grading ({items.length})</h3>
      {items.map((s: any) => (
        <div className="member-row" key={s.id}>
          <span className="dname" style={{ fontSize: 15 }}>{s.display_name}{s.username ? `(${s.username})` : ""}</span>
          <span className="bio" style={{ flex: 1 }}>{s.course_title} · {s.homework_title}</span>
          <a className="btn small" href={s.repo_url} target="_blank" rel="noreferrer">查看</a>{" "}
          <button className="btn small primary" onClick={() => { setFeedback(""); setGrade({ id: s.id, action: "approve" }); }}>通过</button>{" "}
          <button className="btn small danger" onClick={() => { setFeedback(""); setGrade({ id: s.id, action: "reject" }); }}>打回</button>
        </div>
      ))}
      <Modal open={!!grade} onClose={() => setGrade(null)} title={grade?.action === "approve" ? "通过 · 评语（选填）" : "打回 · 修改建议"}>
        <label className="field"><span>反馈（会通知学生）</span>
          <textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} autoFocus /></label>
        <button className="btn small primary" onClick={doGrade}>提交</button>
      </Modal>
    </section>
  );
}

function AdminTools() {
  const { t } = useLang();
  const [msg, setMsg] = useState<string | null>(null);
  const [audience, setAudience] = useState("all");
  const post = (path: string, body: any, ok: string, clear: () => void) => async (e: any) => {
    e.preventDefault();
    setMsg(null);
    try { const r = await api(path, { method: "POST", body: JSON.stringify(body) }); setMsg(`${ok}${r.notified != null ? `（${r.notified} 人）` : ""}`); clear(); } catch (e: any) { setMsg(String(e.message)); }
  };
  const exportData = async () => {
    const data = await api("/admin/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `starisle-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const [aTitle, setATitle] = useState(""); const [aDesc, setADesc] = useState(""); const [aWhen, setAWhen] = useState("");
  const [rName, setRName] = useState(""); const [rDesc, setRDesc] = useState("");
  const [cTitle, setCTitle] = useState(""); const [cText, setCText] = useState("");
  const [ann, setAnn] = useState("");
  return (
    <section style={{ padding: "0 0 28px" }}>
      <h3 style={{display:"flex",alignItems:"center",gap:8}}><I name="spark" size={17} /> 站点运营 · Site operations</h3>
      {msg && <div className="notice" role="status">{msg}</div>}
      <form onSubmit={post("/admin/activities", { title: aTitle, description: aDesc, starts_at: aWhen }, "活动已发布", () => { setATitle(""); setADesc(""); setAWhen(""); })} style={{ marginBottom: 22 }}>
        <b>发布活动</b>
        <div className="toolbar" style={{ marginTop: 8 }}>
          <input type="text" placeholder="标题" value={aTitle} onChange={(e: any) => setATitle(e.target.value)} style={{ width: 180 }} required />
          <input type="text" placeholder="时间，如 2026-10-01 14:00" value={aWhen} onChange={(e: any) => setAWhen(e.target.value)} style={{ width: 200 }} />
          <input type="text" placeholder="说明" value={aDesc} onChange={(e: any) => setADesc(e.target.value)} style={{ width: 260 }} />
          <button className="btn small primary">发布</button>
        </div>
      </form>
      <form onSubmit={post("/admin/resources", { name: rName, description: rDesc }, "资源已上架", () => { setRName(""); setRDesc(""); })} style={{ marginBottom: 22 }}>
        <b>上架资源</b>
        <div className="toolbar" style={{ marginTop: 8 }}>
          <input type="text" placeholder="名称" value={rName} onChange={(e: any) => setRName(e.target.value)} style={{ width: 180 }} required />
          <input type="text" placeholder="说明" value={rDesc} onChange={(e: any) => setRDesc(e.target.value)} style={{ width: 320 }} />
          <button className="btn small primary">上架</button>
        </div>
      </form>
      <form onSubmit={post("/admin/columns", { title: cTitle, text: cText }, "专栏已发布", () => { setCTitle(""); setCText(""); })} style={{ marginBottom: 22 }}>
        <b>发布专栏</b>
        <div style={{ marginTop: 8, maxWidth: 560 }}>
          <input type="text" placeholder="标题" value={cTitle} onChange={(e: any) => setCTitle(e.target.value)} required style={{ marginBottom: 8 }} />
          <Editor value={cText} onChange={setCText} rows={8} />
          <button className="btn small primary" style={{ marginTop: 8 }}>发布</button>
        </div>
      </form>
      <form onSubmit={post("/admin/broadcast", { text: ann, audience }, "已发送", () => setAnn(""))}>
        <b>定向通知</b>
        <div className="toolbar" style={{ marginTop: 8 }}>
          <select value={audience} onChange={(e: any) => setAudience(e.target.value)} style={{ width: "auto" }} aria-label="受众">
            <option value="all">全体成员</option>
            <option value="minors">仅未成年人</option>
            <option value="adults">仅成年人</option>
            <option value="verified">仅已认证成员</option>
          </select>
          <input type="text" placeholder="通知内容" value={ann} onChange={(e: any) => setAnn(e.target.value)} style={{ width: 360 }} required />
          <button className="btn small primary">发送</button>
          <button className="btn small" type="button" onClick={exportData}>导出全部数据 ↓</button>
        </div>
      </form>
    </section>
  );
}

function DeleteBtn({ onConfirm, label, title, warn }: { onConfirm: () => void; label: string; title: string; warn?: string }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (<>
    <button className="btn small danger" onClick={() => setOpen(true)}>{label}</button>
    <Modal open={open} onClose={() => setOpen(false)} title={title}>
      {warn && <p style={{ fontSize: 14.5, color: "var(--ink-2)", marginTop: 0 }}>{warn}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn small danger" onClick={() => { setOpen(false); onConfirm(); }}>{t.confirm_delete}</button>
        <button className="btn small" onClick={() => setOpen(false)}>{t.cancel}</button>
      </div>
    </Modal>
  </>);
}

function Reject({ onOk, label }: { onOk: (reason: string) => void; label: string }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (<>
    <button className="btn small danger" onClick={() => setOpen(true)}>{label}</button>
    <Modal open={open} onClose={() => setOpen(false)} title={t.reason}>
      <label className="field"><span>{t.reason}</span>
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></label>
      <button className="btn small danger" onClick={() => { onOk(reason || "未说明原因"); setOpen(false); setReason(""); }}>确认拒绝</button>
    </Modal>
  </>);
}

function RoleModal({ m, onSaved }: { m: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(m.role);
  return (<>
    <button className="btn small" onClick={() => { setRole(m.role); setOpen(true); }}>{m.role === "admin" ? "管理" : m.role === "teacher" ? "导师" : "成员"}</button>
    <Modal open={open} onClose={() => setOpen(false)} title={`设置角色 · ${m.display_name}`}>
      <label className="field"><span>角色</span>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="member">成员 member</option><option value="teacher">导师 teacher</option><option value="admin">管理员 admin</option>
        </select></label>
      <button className="btn small primary" onClick={async () => { await api(`/admin/members/${m.id}/role`, { method: "POST", body: JSON.stringify({ role }) }); setOpen(false); onSaved(); }}>保存</button>
    </Modal>
  </>);
}
