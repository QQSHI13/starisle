import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const zh = {
  nav_home: "首页", nav_projects: "项目", nav_courses: "课程", nav_columns: "专栏",
  nav_activities: "活动", nav_students: "学生", nav_resources: "资源", nav_mentors: "导师",
  login: "登录", logout: "退出登录", apply: "申请加入", me: "个人中心", admin: "管理后台",
  hero_kicker: "北京少年人工智能学院 · 星屿社区",
  hero_title_a: "和优秀的同龄人，", hero_title_b: "一起做真实项目。",
  hero_body: "星屿是一个邀请制的青少年 AI 开发者社区。准入凭申请与人工审核，作品凭开源仓库说话——这里没有包装出来的光鲜，只有跑得起来的代码。",
  hero_cta_projects: "看看大家在做什么", hero_cta_apply: "申请加入",
  trust_repo: "每个项目都对应真实的开源仓库", trust_scope: "哪些资料公开，一目了然", trust_review: "每一条内容经人工审核后发布",
  stat_members: "社区成员", stat_projects: "进行中的项目", stat_courses: "已开设课程", stat_activities: "近期活动",
  featured: "精选项目", all_projects: "全部项目", search_placeholder: "搜索项目名称或介绍…",
  all_domains: "全部领域", members_n: "位成员", recruiting: "正在招募", updated_recently: "近 30 天有更新",
  open_role: "缺", join_project: "申请加入这个项目", gaps_title: "正在招募的角色",
  repo: "源码仓库", demo: "在线演示", owner: "发起人", contributors: "项目成员",
  courses_title: "课程", courses_sub: "从一门实打实的课程开始。提交申请后，由运营逐人开通学习权限。",
  hours: "课时", lessons: "节", featured_badge: "精选", apply_course: "申请学习",
  columns_title: "专栏", columns_sub: "成员们的项目手记与真实观察，经脱敏和审核后发布。",
  students_title: "学生", students_sub: "所有通过审核的成员与他们的公开主页。",
  no_bio: "这位成员还没有填写简介。", view_profile: "查看主页", projects_of: "参与的项目",
  mentors_title: "导师", mentors_sub: "提交申请后由运营审核；通过后，运营会为你和导师牵线。",
  request_mentor: "申请指导", your_interest: "想钻研的方向", your_background: "你的背景（选填）",
  your_questions: "想请教的问题（选填）", submit: "提交", submitted: "已提交，请等待运营处理。",
  activities_title: "活动", activities_sub: "工作坊、路演与固定 Office Hour，面向已通过审核的成员开放。",
  activities_empty: "下一期活动正在筹备中。开放报名时会第一时间在此公布，并通过站内消息通知全体成员。",
  resources_title: "资源", resources_sub: "校企合作，以及算力、数据等方面的支持。",
  resources_empty: "各项支持正在与合作机构逐一落实。确认可用后，我们会把具体内容与申请方式一并公布——在那之前，这里不展示任何不存在的东西。",
  partners: "合作中学与机构",
  apply_title: "申请加入星屿", apply_sub: "我们只看你在真实做什么。每一份申请都由运营人工审核；通过后，同一账号即可登录社区。",
  username: "用户名（真实姓名）", username_hint: "用于登录和个人主页地址。当前要求真实姓名，便于成员之间互认；之后可在个人中心验证密码后修改。",
  password: "密码", display_name: "显示名（网名）", display_name_hint: "其他成员看到的名字，用网名或昵称都可以，随时可以改。",
  email: "邮箱", repo_url: "开源仓库链接（选填）", statement: "申请说明（至少 10 个字）",
  consent_privacy: "我已阅读《隐私与未成年人说明》；如为未成年人，已与监护人共同阅读并取得同意。",
  consent_public: "我确认知晓：用户名、显示名、个人主页以及已上线项目的成员关系均会公开。",
  apply_submit: "提交申请", apply_query: "查询申请状态", apply_token_hint: "请妥善保存以下回执编号，凭它可随时查询审核进度。",
  cancel: "取消", confirm_delete: "确认删除", delete_project_warn: "删除后项目将从社区消失，关联的进展、成员关系和关注记录会一并移除。此操作不可撤销。",
  query_hint: "输入申请时填写的用户名和密码即可查询审核结果。",
  status_pending: "审核中", status_approved: "已通过", status_rejected: "未通过",
  login_title: "登录星屿", login_sub: "使用申请时设置的用户名和密码。",
  recovery: "账号恢复", recovery_sub: "本站没有邮件找回功能。恢复码可以在忘记密码时替代原密码，完成一次重置。",
  gen_code: "生成备用恢复码", gen_code_sub: "验证当前密码后生成，90 天内有效，只能使用一次。请生成后立即保存，离开页面前确认已经存好。",
  use_code: "使用已保存的恢复码", new_password: "新密码（8–72 位）", reset_password: "重置密码并退出所有设备",
  me_title: "个人中心", my_projects: "我的项目", new_project: "发起项目", notifications: "站内消息",
  project_name: "项目名称", tagline: "一句话介绍", description: "详细介绍", create: "创建项目",
  pending_review: "等待审核", edit: "编辑", delete: "删除", save: "保存",
  enrollments: "我的课程申请", mentor_requests_mine: "我的指导申请",
  admin_apps: "入会申请", admin_projects: "待审核项目", admin_enroll: "课程开通申请",
  approve: "通过", reject: "拒绝", reason: "原因", no_items: "当前没有待处理的事项。",
  privacy_title: "隐私与未成年人说明",
  not_found: "你要找的页面不存在。", back_home: "返回首页",
  footer_tag: "代码留在开源仓库，星屿负责成员、项目与连接。邀请制入驻，人工审核——未成年人的安全，优先于一切功能。",
  footer_browse: "站内导航", mark_all_read: "全部标为已读", delete_msg: "删除", loading: "载入中…", error: "出错了，请稍后重试", language: "EN", theme_dark: "深色", theme_light: "浅色",
};

export type Lang = "zh" | "en";
export const en: Record<keyof typeof zh, string> = {
  ...zh,
  nav_home: "Home", nav_projects: "Projects", nav_courses: "Courses", nav_columns: "Writing",
  nav_activities: "Events", nav_students: "Students", nav_resources: "Resources", nav_mentors: "Mentors",
  login: "Sign in", logout: "Sign out", apply: "Apply to join", me: "My account", admin: "Admin",
  hero_kicker: "Beijing Youth AI Academy · Starisle",
  hero_title_a: "Build real projects", hero_title_b: "with peers as serious as you.",
  hero_body: "Starisle is an invite-only community of teenage AI builders. You get in through an application reviewed by a human; your work speaks through its open-source repository. No polished veneer here — only code that actually runs.",
  hero_cta_projects: "See what people are building", hero_cta_apply: "Apply to join",
  trust_repo: "Every project links a real repository", trust_scope: "Exactly what is public is spelled out", trust_review: "Every piece of content is human-reviewed before it ships",
  stat_members: "members", stat_projects: "projects in progress", stat_courses: "courses offered", stat_activities: "upcoming events",
  featured: "Featured projects", all_projects: "All projects", search_placeholder: "Search by name or description…",
  all_domains: "All fields", members_n: "members", recruiting: "recruiting", updated_recently: "updated this month",
  open_role: "Needs", join_project: "Apply to join this project", gaps_title: "Open roles",
  repo: "Source repository", demo: "Live demo", owner: "Started by", contributors: "Team",
  courses_title: "Courses", courses_sub: "Start with a course that asks real work of you. Apply, and access is granted one by one after review.",
  hours: "class hours", lessons: "sessions", featured_badge: "Featured", apply_course: "Request access",
  columns_title: "Writing", columns_sub: "Project notes and honest field observations from members, published after review.",
  students_title: "Students", students_sub: "Every approved member, and their public pages.",
  no_bio: "No bio yet.", view_profile: "View profile", projects_of: "Projects",
  mentors_title: "Mentors", mentors_sub: "Requests are reviewed by the team; once one is approved, we make the introduction personally.",
  request_mentor: "Request mentoring", your_interest: "What do you want to dig into?", your_background: "Your background (optional)",
  your_questions: "What you'd like to ask (optional)", submit: "Submit", submitted: "Submitted — the team will take it from here.",
  activities_title: "Events", activities_sub: "Workshops, demo days and standing office hours, open to approved members.",
  activities_empty: "The next event is being planned. Registration opens here first, and every member gets an on-site message.",
  resources_title: "Resources", resources_sub: "School–industry partnerships, plus compute and data support.",
  resources_empty: "These offerings are being finalized with partner institutions. Once they are real, what is available and how to apply will be published here — until then, nothing is displayed.",
  partners: "Partner schools & institutions",
  apply_title: "Apply to Starisle", apply_sub: "We look only at what you actually build. Every application is reviewed by a human; once approved, the same account signs in.",
  username: "Username (real name)", username_hint: "Used to sign in and in your profile URL. A real name is required for now so members can recognize each other; you can change it later after verifying your password.",
  password: "Password", display_name: "Display name", display_name_hint: "What everyone sees — a nickname is fine, and you can change it anytime.",
  email: "Email", repo_url: "Repository link (optional)", statement: "Tell us what you've built, or want to build (at least 10 characters)",
  consent_privacy: "I have read the Privacy & Minors notice. If I'm under 18, my parent or guardian has read it with me and consents.",
  consent_public: "I understand that my username, display name, profile, and memberships on published projects are public.",
  apply_submit: "Submit application", apply_query: "Check application status", apply_token_hint: "Keep this receipt — you can check your review progress with it at any time.",
  cancel: "Cancel", confirm_delete: "Delete", delete_project_warn: "Deleting removes the project from the community along with its updates, memberships and follows. This cannot be undone.",
  query_hint: "Enter the username and password from your application to check the result.",
  status_pending: "Under review", status_approved: "Approved", status_rejected: "Not approved",
  login_title: "Sign in to Starisle", login_sub: "Use the username and password you set in your application.",
  recovery: "Account recovery", recovery_sub: "There is no email-based reset. A recovery code stands in for your old password and lets you set a new one — exactly once.",
  gen_code: "Generate a recovery code", gen_code_sub: "Requires your current password. Valid for 90 days, usable once. Save it immediately, and don't leave the page before you have.",
  use_code: "Use a saved code", new_password: "New password (8–72 characters)", reset_password: "Reset password and sign out everywhere",
  me_title: "My account", my_projects: "My projects", new_project: "Start a project", notifications: "Messages",
  project_name: "Project name", tagline: "One-line intro", description: "Details", create: "Create project",
  pending_review: "Under review", edit: "Edit", delete: "Delete", save: "Save",
  enrollments: "My course requests", mentor_requests_mine: "My mentoring requests",
  admin_apps: "Membership applications", admin_projects: "Projects awaiting review", admin_enroll: "Course access requests",
  approve: "Approve", reject: "Reject", reason: "Reason", no_items: "Nothing waiting on you.",
  privacy_title: "Privacy & minors",
  not_found: "That page doesn't exist.", back_home: "Back to the homepage",
  footer_tag: "Code lives in open repositories; Starisle is where members, projects and introductions happen. Invite-only, human-reviewed — minors' safety comes before every feature.",
  footer_browse: "Navigate", mark_all_read: "Mark all read", delete_msg: "Delete", loading: "Loading…", error: "Something went wrong — please try again", language: "中文", theme_dark: "Dark", theme_light: "Light",
};

type Dict = typeof zh;
type Ctx = { lang: Lang; t: Dict; toggle: () => void; theme: "light" | "dark"; toggleTheme: () => void };
const LangContext = createContext<Ctx>({
  lang: "zh", t: zh, toggle: () => {}, theme: "light", toggleTheme: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(
    () => (localStorage.getItem("lang") as Lang) || "zh"
  );
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("theme") as "light" | "dark") || "light"
  );

  const toggle = () => {
    const next: Lang = lang === "zh" ? "en" : "zh";
    localStorage.setItem("lang", next);
    setLang(next);
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
  };
  const toggleTheme = () => {
    document.documentElement.classList.add("theme-anim");
    setTimeout(() => document.documentElement.classList.remove("theme-anim"), 300);
    const next = theme === "light" ? "dark" : "light";
    localStorage.setItem("theme", next);
    setTheme(next);
    document.documentElement.dataset.theme = next;
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [theme, lang]);

  return (
    <LangContext.Provider value={{ lang, t: lang === "zh" ? zh : en, toggle, theme, toggleTheme }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
