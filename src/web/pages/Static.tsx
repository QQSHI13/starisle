import { useLang } from "../i18n";
import { useFetch } from "../hooks";
import { api } from "../api";
import { useMe } from "../App";
import { useState } from "react";
import { useToast } from "../toast";

export function Activities() {
  const { t, lang } = useLang();
  const { me } = useMe();
  const toast = useToast();
  const { data } = useFetch<{ activities: any[] }>("/activities");
  const [counts, setCounts] = useState<Record<number, number>>({});
  const items = data?.activities ?? [];
  const rsvp = async (id: number) => {
    const r = await api(`/activities/${id}/rsvp`, { method: "POST" });
    setCounts((c) => ({ ...c, [id]: r.count }));
    toast(r.going ? (lang === "zh" ? "已报名" : "RSVP'd") : (lang === "zh" ? "已取消报名" : "Cancelled"));
  };
  return (
    <>
      <div className="page-head"><div className="wrap">
        <p className="kicker">{t.nav_activities}</p>
        <h1>{t.activities_title}</h1>
        <p className="sub">{t.activities_sub}</p>
      </div></div>
      <section className="block"><div className="wrap">
        {items.length === 0 ? (
          <div className="empty"><b>{t.activities_title}</b>{t.activities_empty}</div>
        ) : (
          <div className="grid">
            {items.map((a) => (
              <div className="card" key={a.id}>
                <h3>{a.title}</h3>
                <p className="tagline">{a.description}</p>
                <div className="meta"><span>{a.starts_at}</span>{a.location && <span>{a.location}</span>}
                  {me && <button className="btn small" onClick={() => rsvp(a.id)}>{lang === "zh" ? "报名" : "RSVP"} · {counts[a.id] ?? "?"}</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div></section>
    </>
  );
}

export function Resources() {
  const { t } = useLang();
  const { data: res } = useFetch<{ resources: any[] }>("/resources");
  const { data: partners } = useFetch<{ partners: any[] }>("/partners");
  return (
    <>
      <div className="page-head"><div className="wrap">
        <p className="kicker">{t.nav_resources}</p>
        <h1>{t.resources_title}</h1>
        <p className="sub">{t.resources_sub}</p>
      </div></div>
      <section className="block"><div className="wrap">
        {(res?.resources ?? []).length === 0 && (
          <div className="empty"><b>{t.resources_title}</b>{t.resources_empty}</div>
        )}
        <h3 style={{ margin: "40px 0 18px" }}>{t.partners}</h3>
        <div className="grid">
          {(partners?.partners ?? []).map((p) => (
            <a className="card" key={p.id} href={p.website} target="_blank" rel="noreferrer">
              {p.logo_url && <img className="partner-logo" src={p.logo_url} alt={p.name} loading="lazy" />}
              <h3>{p.name}</h3>
              <div className="meta"><span className="pill">{p.category}</span></div>
            </a>
          ))}
        </div>
      </div></section>
    </>
  );
}

export function Privacy() {
  const { t, lang } = useLang();
  const zh = lang === "zh";
  return (
    <>
      <div className="page-head"><div className="wrap">
        <p className="kicker">2026-09-17</p>
        <h1>{t.privacy_title}</h1>
      </div></div>
      <div className="wrap"><article className="prose">
        {zh ? (<>
          <h2>申请前请先了解</h2>
          <p>注册会收集用户名、显示名、邮箱、密码和申请说明；开源链接为选填。这些信息用于审核申请、登录和提供社区功能。密码以加盐哈希保存，任何人不能查看原密码。本站目前没有邮箱验证或邮件找回密码功能。</p>
          <p><strong>用户名会出现在公开成员资料和主页地址中。</strong>当前注册要求填写真实姓名，因此不要把用户名误认为仅管理员可见。显示名、头像、个人简介、开源链接及已上线的项目和成员关系也会公开。邮箱和申请说明不在公开成员目录中展示，管理员可为审核和账号管理查看必要资料。</p>
          <p>注册时分别确认阅读说明和公开资料范围。暂不愿公开上述资料，请先不要提交申请；仍可浏览公开内容。</p>
          <h2>未成年人及监护人</h2>
          <p>未成年人请与监护人共同阅读，提交前取得监护人同意。未满 14 周岁的申请人，请先通过原有入会渠道与管理员、监护人确认授权安排；确认前请不要提交个人信息。页面勾选本身不代表已经完成监护人身份核验。</p>
          <p>不要在简介、仓库、评论或申请说明中上传身份证、家庭住址、私人电话、学校班级等不必要的信息，也不要公开他人的私人资料。公开仓库和第三方平台有各自的隐私规则。</p>
          <h2>浏览器、上传与保存</h2>
          <p>登录使用浏览器 Cookie；会话记录包含到期时间、IP 和浏览器信息。申请回执保存在提交申请的设备上，用于查询审核结果。清除浏览器数据可能使回执丢失，但仍可凭用户名和密码查询申请。</p>
          <h2>修改、注销与账号恢复</h2>
          <p>登录后可在个人信息设置中修改资料和密码。用户名变更需要验证当前密码；注销前需先撤回自己发起的项目。注销功能会停用账号并清除部分个人资料，用户名、关联记录和备份可能保留，不等同于立即彻底删除所有历史数据。</p>
          <p>可在账号恢复页面验证当前密码后生成一次性恢复码。恢复码仅显示一次，请自行妥善保存；不要发给其他人。没有预先保存的有效恢复码时，本站不能自动找回密码。</p>
          <h2>隐私咨询与举报</h2>
          <p>已有入会联系渠道的用户，可通过该渠道向管理员反馈，并仅提供定位问题所需的页面链接和说明。不要发送密码、恢复码或无关个人信息。申请和项目由人工审核，目前没有承诺固定处理时限。申请可在“申请查询”查看；项目审核结果及补充要求会发送到站内消息。</p>
        </>) : (<>
          <h2>Before you apply</h2>
          <p>Registration collects username, display name, email, password and an application statement; a repository link is optional. This information is used to review applications, sign you in and provide community features. Passwords are stored as salted hashes and cannot be read back by anyone. There is no email verification or email password reset.</p>
          <p><strong>Your username appears in the public member directory and your profile URL.</strong> Real names are currently required at registration. Display name, avatar, bio, repository links, published projects and project memberships are also public. Email and application statements are not shown in the public directory; admins may view what is necessary for review and account management.</p>
          <p>If you do not want this information public, do not submit an application yet. Public content remains browsable.</p>
          <h2>Minors and guardians</h2>
          <p>Minors must read this notice together with a guardian and obtain consent before submitting. Applicants under 14 should first confirm authorization arrangements with an admin and guardian through the existing enrollment channel. Checking a box on the page does not complete guardian verification.</p>
          <p>Do not post ID numbers, home addresses, private phone numbers, school and class details, or other people's personal information in bios, repositories, comments or applications.</p>
          <h2>Sessions, uploads and retention</h2>
          <p>Sign-in uses browser cookies; session records include expiry, IP and browser information. The application receipt is stored on the device used to apply. Clearing browser data may lose the receipt, but you can still query by username and password.</p>
          <h2>Changes, deactivation and recovery</h2>
          <p>You can edit your profile and password after signing in. Changing your username requires your current password. Deactivating removes part of your profile; usernames, relationship records and backups may be retained and deletion is not instant.</p>
          <p>A one-time recovery code can be generated after password verification. It is shown exactly once — keep it safe, never share it. Without a saved valid code there is no automated way to reset a password.</p>
          <h2>Contact and reports</h2>
          <p>Users with an existing enrollment contact channel can report issues there, providing only the links and details needed. Never send passwords or recovery codes. Applications and projects are human-reviewed with no fixed processing time limit; application status is available on the status page, and project review results arrive as on-site messages.</p>
        </>)}
      </article></div>
    </>
  );
}
