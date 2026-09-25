// Idempotent demo enrichment: rich content in every corner of the site.
// Run after the normal seed: bun scripts/seed-demo.mjs  (applies to data/starisle.db)
import { DatabaseSync } from "node:sqlite";
import { pbkdf2Sync } from "node:crypto";
import { existsSync } from "node:fs";

const path = process.env.STARISLE_DB || new URL("../data/starisle.db", import.meta.url).pathname;
if (!existsSync(path)) { console.error("run the server once first (bun src/server/node.ts) so data/starisle.db exists"); process.exit(1); }
const db = new DatabaseSync(path);
const hash = pbkdf2Sync("starisle-dev", "demo-salt", 100_000, 32, "sha256").toString("hex");
const q = (sql, ...a) => db.prepare(sql).run(...a);
const one = (sql, ...a) => db.prepare(sql).get(...a);



// demo members (roles for the storyline)
for (const [u, d, role] of [["林小满", "小满", "member"], ["陈以恒", "以恒", "member"]]) {
  q(`INSERT OR IGNORE INTO members (username, display_name, email, bio, password_hash, salt, role, is_minor, email_verified, created_at)
     VALUES (?,?,?,?,?,?, 'member', 1, 1, datetime('now','-20 days'))`, u, d, `${u}@example.com`, "星屿社区成员，喜欢把想法做成真的东西。", hash, "demo-salt");
}
const xiaoman = one("SELECT id FROM members WHERE username='林小满'").id;
const yiheng = one("SELECT id FROM members WHERE username='陈以恒'").id;
const admin = one("SELECT id FROM members WHERE role='admin' LIMIT 1").id;

// a demo project by 林小满, approved, with everything
q(`INSERT OR IGNORE INTO projects (slug, name, tagline, body, repo_url, domain_id, status, owner_id, created_at, updated_at, featured)
   VALUES ('campus-river-watch','校园河流观察站','用便宜的传感器 + 一个网页，让全班看到校门口那条河每天的变化',
   '我们怀疑校门口的河水在雨后变得更浑浊。\n\n这个项目的计划：\n\n1. 用浊度传感器每天采样\n2. 数据传到这个网站，画成折线图\n3. 和环保课一起写一份给学校的报告\n\n**目前已经完成了 14 天采样**，数据在仓库里。',
   'https://github.com/NumberSky/Stellar-Crossroads','climate','approved',?, datetime('now','-9 days'), datetime('now','-2 days'), 1)`, xiaoman);
q("UPDATE projects SET body = REPLACE(body, '\\n', char(10)) WHERE slug='campus-river-watch'");
const proj = one("SELECT id FROM projects WHERE slug='campus-river-watch'").id;
q(`INSERT OR IGNORE INTO project_members (project_id, member_id, role) VALUES (?,?, 'owner')`, proj, xiaoman);
q(`INSERT OR IGNORE INTO project_members (project_id, member_id, role) VALUES (?,?, 'member')`, proj, yiheng);
q(`INSERT OR IGNORE INTO project_stacks (project_id, tag) VALUES (?,?), (?,?), (?,?)`,
  proj, "Arduino", proj, "Chart.js", proj, "数据可视化");
q(`INSERT OR IGNORE INTO project_gaps (project_id, label) VALUES (?, '缺 前端可视化 — 等你补位')`, proj);
for (const [t, done, sort] of [["完成传感器焊接", 1, 0], ["连续采样 14 天", 1, 1], ["数据大屏可视化", 0, 2], ["写给学校的报告", 0, 3]]) {
  q(`INSERT INTO project_milestones (project_id, text, done, sort) SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM project_milestones WHERE project_id=? AND text=?)`, proj, t, done, sort, proj, t);
}
// approved dev-log updates
for (const [uid, t, days] of [[xiaoman, "第 14 天数据齐了！雨后的浊度确实会跳高 3 倍左右，折线图已经能看出规律。", 2], [yiheng, "帮小满把采样脚本改成了每天早上 7 点自动跑，以后不用手动记了。", 1]]) {
  q(`INSERT INTO project_updates (project_id, author_id, text, status, created_at) VALUES (?,?,?, 'approved', datetime('now', '-' || ? || ' days'))`, proj, uid, t, days);
}
// follows: 施清荃 follows the project + 林小满
q(`INSERT OR IGNORE INTO project_follows (project_id, member_id) VALUES (?, (SELECT id FROM members WHERE username='施清荃'))`, proj);
q(`INSERT OR IGNORE INTO member_follows (followee_id, follower_id) VALUES (?,(SELECT id FROM members WHERE username='施清荃'))`, xiaoman);

// flagship demo column: markdown + KaTeX + mermaid showcase
if (!one("SELECT 1 x FROM columns WHERE slug='demo-building-in-public'"))
q(`INSERT INTO columns (slug, column_label, title, subtitle, author, author_title, text, published_at)
   VALUES ('demo-building-in-public','社区投稿','在星屿，一个想法怎么变成作品','从「我想试试」到「跑起来了」：三位成员的真实项目手记','林小满','星屿社区成员 · 校园河流观察站发起人',
'有人说青少年做项目就是玩。我们想用这篇文章回答：**怎么把一个模糊的想法，做成一个真的能跑、有人用、还在生长的作品。**

## 第一步：把问题说小

「保护河流」太大，「测一测校门口的河水什么时候最浑」就够小。能在一周内开始验证的问题，才配叫开始。

## 我们的协作方式

\`\`\`mermaid
flowchart LR
    A[小满: 硬件与采样] --> C[(共享数据)]
    B[以恒: 脚本与自动化] --> C
    C --> D[可视化大屏]
    C --> E[给学校的报告]
\`\`\`

## 数据里的数学

浊度变化的拟合很简单，就是一个线性回归：

$$T = \\alpha \\cdot R + \\beta + \\varepsilon$$

其中 $T$ 是浊度，$R$ 是降雨量。我们的样本量还小，但这是属于我们自己的模型。

| 天数 | 浊度 (NTU) | 天气 |
|---|---|---|
| 1–5 | 12.4 ± 2.1 | 晴 |
| 6–8 | 41.7 ± 8.3 | 雨后 |
| 9–14 | 15.0 ± 3.2 | 多云 |

## 给想开始的你

1. 先做一个丑但能用的版本，**公开**它；
2. 每周写一条进展，哪怕只有一句话；
3. 找一个同伴，互相看对方的仓库。

> 作品自己会说话。你要做的只是让它存在。

*—— 写于第 14 次采样后的傍晚*', date('now','-1 day'))`);
const col = one("SELECT id FROM columns WHERE slug='demo-building-in-public'").id;

// approved discussion on the column
q(`INSERT INTO comments (target_type, target_id, author_id, text, status, created_at)
   VALUES ('column', ?, ?, '「能在一周内开始验证的问题，才配叫开始」—— 这句话我抄走了，谢谢小满！', 'approved', datetime('now','-20 hours'))`, col, yiheng);
q(`INSERT INTO comments (target_type, target_id, author_id, text, status, created_at)
   VALUES ('column', ?, (SELECT id FROM members WHERE username='施清荃'), '数据表格和公式渲染得很清楚，已转发给课程组。', 'approved', datetime('now','-8 hours'))`, col);

// pending comment (so the admin queue is non-empty)
q(`INSERT INTO comments (target_type, target_id, author_id, text, status, created_at)
   VALUES ('column', ?, ?, '想问下传感器是在哪买的？我们组也想做一个。', 'pending', datetime('now','-3 hours'))`, col, yiheng);

// events + resources (no more empty states)
q(`INSERT INTO activities (title, description, starts_at, location)
   SELECT '2026 秋季项目路演', '各组现场演示真实作品，导师和中学教师现场点评。报名已通过站内消息发送。', datetime('now','+3 days','14:00'), '少年学院报告厅'
   WHERE NOT EXISTS (SELECT 1 FROM activities WHERE title='2026 秋季项目路演')`);
q(`INSERT INTO resources (name, description, status)
   SELECT '边缘计算开发板借用', '每个项目组可申请 2 块开发板，借用期 4 周，损坏了照价赔偿。联系运营登记。', 'available'
   WHERE NOT EXISTS (SELECT 1 FROM resources WHERE name='边缘计算开发板借用')`);
q(`INSERT INTO resources (name, description, status)
   SELECT '课程算力券', '已开通课程成员每月可申请 50 元模型 API 额度，用于课程作业和项目实验。', 'available'
   WHERE NOT EXISTS (SELECT 1 FROM resources WHERE name='课程算力券')`);

// lessons + homework on the featured course
const course = one("SELECT id FROM courses WHERE slug='c-2e2241'").id;
for (const [t, sum, sort] of [["第 1 课：什么是人工智能", "从图灵测试讲到今天的生成式模型，建立直觉", 1], ["第 2 课：机器学习是怎么学的", "用房价预测的例子讲清训练、验证与过拟合", 2], ["第 3 课：伦理与边界", "幻觉、偏见、隐私——用三个真实案例讨论", 3]]) {
  q(`INSERT INTO course_lessons (course_id, title, summary, sort) SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM course_lessons WHERE course_id=? AND title=?)`, course, t, sum, sort, course, t);
}
const lesson = one("SELECT id FROM course_lessons WHERE course_id=? ORDER BY sort LIMIT 1", course).id;
q(`INSERT INTO homework (lesson_id, title, instructions, due_at)
   SELECT ?, '找一个你身边的 AI', '写一个 300 字的观察：它解决了什么问题？它的边界在哪？提交仓库或文档链接。', datetime('now','+5 days','20:00')
   WHERE NOT EXISTS (SELECT 1 FROM homework WHERE title='找一个你身边的 AI')`, lesson);
// enrollment + submission for the storyline
q(`INSERT OR IGNORE INTO enrollments (member_id, course_id, status) VALUES (?,?,'approved')`, xiaoman, course);
const hw = one("SELECT id FROM homework WHERE title='找一个你身边的 AI'").id;
q(`INSERT OR IGNORE INTO submissions (homework_id, member_id, repo_url, note) VALUES (?,?,?,?)`, hw, xiaoman, "https://github.com/NumberSky/Stellar-Crossroads", "我观察的是学校的考勤摄像头……（节选）");

// pending join request to the demo project (owner inbox non-empty)
q(`INSERT OR IGNORE INTO join_requests (project_id, member_id, message) VALUES (?,?, '会 Chart.js，想负责可视化大屏')`, proj, yiheng);
// a notification for admin/demo user
q(`INSERT INTO notifications (member_id, text, type) SELECT id, '路演报名开启：各组负责人记得在周五前更新项目展板。', 'announce' FROM members WHERE username='施清荃'`);

// more life: updates across real projects, a note post, mentor request, more comments
const moreUpdates = [
  ["p-2c3879", "李剑", "2D 版 now runs on phones — 触屏操作修完了，欢迎试玩"],
  ["harry-potter", "朱天野", "魔咒系统重构完成，现在可以组合施法了"],
  ["3d", "施清荃", "3D 场景LOD优化，帧率从 22 提到 55"],
  ["p-be8ab8", "袁梦雷", "机械臂视觉标定第 3 版，抓取成功率 87%"],
];
for (const [slug, owner, text] of moreUpdates) {
  q(`INSERT INTO project_updates (project_id, author_id, text, status, created_at)
     SELECT p.id, m.id, ?, 'approved', datetime('now', '-' || (abs(random()) % 50 + 2) || ' hours')
     FROM projects p JOIN members m ON m.username = ?
     WHERE p.slug = ? AND NOT EXISTS (SELECT 1 FROM project_updates u WHERE u.project_id = p.id AND u.text = ?)`,
     text, owner, slug, text);
}
// second column: a short note kind with topics
q(`INSERT INTO columns (slug, column_label, title, subtitle, author, author_title, text, kind, topics, published_at)
   SELECT 'demo-weekly-no1','社区投稿','星屿周报 · 第 1 期','两周里，社区里发生的事','演示管理员','星屿运营组',
   '## 本周数字\n\n- 新增项目动态 **6** 条\n- 路演报名开启\n- 河流观察站完成 14 天采样\n\n## 值得关注\n\n#硬件 组的机械臂标定到了第 3 版；#游戏 组的大宋英雄传 2D 支持手机了。\n\n> 下周开始，每周日晚更新。',
   'note', '#周报 #硬件 #游戏', date('now','-2 day')
   WHERE NOT EXISTS (SELECT 1 FROM columns WHERE slug='demo-weekly-no1')`);
// pending mentor request for admin queue
q(`INSERT INTO mentor_requests (member_id, mentor_id, interest, background, questions, status)
   SELECT (SELECT id FROM members WHERE username='林小满'), (SELECT id FROM mentors WHERE name='张雨桐'),
   '想用数学模型解释我们测到的浊度数据', '初一，学过一元一次方程和基础统计', '线性回归需要什么前提？我们的样本量够吗？', 'pending'
   WHERE NOT EXISTS (SELECT 1 FROM mentor_requests WHERE interest LIKE '%浊度%')`);
// extra approved comments on demo column
q(`INSERT INTO comments (target_type, target_id, author_id, text, status, created_at)
   SELECT 'column', c.id, (SELECT id FROM members WHERE username='陈以恒'), '公式渲染出来了！我们报告里也想用这样的排版。', 'approved', datetime('now','-6 hours')
   FROM columns c WHERE c.slug='demo-building-in-public'
     AND NOT EXISTS (SELECT 1 FROM comments WHERE text LIKE '%报告里也想用%')`);
// rsvps for the event
q(`INSERT OR IGNORE INTO rsvps (activity_id, member_id)
   SELECT a.id, m.id FROM activities a, members m WHERE m.username IN ('林小满','陈以恒','施清荃') AND a.title LIKE '%路演%'`);
console.log("demo content installed: project, column (md+katex+mermaid), comments, events, resources, lessons, homework, submission, join request, notification");

// ─────────────────────────────────────────────────────────────────────────────
// Demo enrichment · round 2 (2026-09): five projects across domains, three
// columns (note / showcase / article), two events, resources, comments,
// notifications and follow edges. Idempotent: every insert is guarded by a
// slug/title uniqueness check, all wrapped in one transaction.
// ─────────────────────────────────────────────────────────────────────────────
const jolly = one("SELECT id FROM members WHERE display_name='Jolly'").id;
const zoom = one("SELECT id FROM members WHERE display_name='Zoom'").id;

const newProjects = [
  {
    slug: "homework-copilot-agent", name: "作业搭子 Agent", domain: "agent", owner: xiaoman, featured: 1,
    tagline: "一个跑在自己电脑上的学习助手：把错题拆开讲清楚，而不是直接给答案",
    repo: "https://github.com/ollama/ollama", demo: null,
    created: "-20 days", updated: "-1 day",
    body: `做作业最怕的不是不会，是**不敢问**：问同学怕打扰，问搜索引擎怕抄错，问家长往往得到一句「这都不会？」。

作业搭子 Agent 的思路是：在本地用 Ollama 跑一个 7B 小模型，拍照导入错题后，它只给**提示**不给答案——先问「你觉得这一步卡在哪」，一步步把人带回到正确的思路上。

目前已经跑通的最小闭环：

1. 错题拍照入库，自动识别科目和知识点
2. 对话式拆解：一次只推进一步
3. 所有对话记录只存在本机，家长模式可以回看

我们希望它像一个有耐心、但绝不代写的同桌。`,
    stacks: ["Ollama", "Node.js", "SQLite"],
    milestones: [["确定本地部署方案（7B 模型）", 1, 0], ["错题拍照入库", 1, 1], ["家长监督模式", 0, 2]],
    updates: [
      [xiaoman, "本地部署跑通了！用 qwen2.5:7b 试了一道一元二次方程，提示给得很克制，没有直接报答案。", 1],
      [xiaoman, "加了错题科目自动分类，准确率大概八成，数学最好，语文最差（意料之中）。", 4],
    ],
    gap: null,
  },
  {
    slug: "rural-math-bridge", name: "乡村数学云课堂", domain: "edu", owner: yiheng, featured: 0,
    tagline: "给没有竞赛老师的乡镇初中，攒一套能自学的数学微课",
    repo: null, demo: null,
    created: "-18 days", updated: "-3 days",
    body: `我们镇上的初中没有竞赛老师，有兴趣的同学只能对着旧题集硬啃。但平板和网络，教室里是有的。

这个项目的计划很朴素：把数论、组合这些专题拆成 **8–12 分钟一节**的微课，配可交互的例题页面，让同学按自己的节奏学，不懂的地方在页面里直接提问。

目前已经完成：

1. 前 6 节「整除与同余」微课的录制和剪辑
2. 一个能播放课程、记录进度的静态网页

下一步想找一位会视频后期的同学加入，把每节课的开头统一做得更抓人。`,
    stacks: ["Hugo", "JavaScript", "OBS"],
    milestones: [["完成 6 节微课录制", 1, 0], ["课程网页上线内测", 1, 1], ["募齐 12 节并公开", 0, 2]],
    updates: [
      [yiheng, "第 6 节课剪完了！同余那一节用「钟表」引入，试给同桌看，他说终于懂了。", 2],
      [yiheng, "网页加了学习进度条，现在能看到自己学到哪一节。", 5],
    ],
    gap: "缺 视频剪辑 — 等你补位",
  },
  {
    slug: "classroom-carbon-ledger", name: "教室碳账本", domain: "climate", owner: jolly, featured: 0,
    tagline: "用一块人体存在传感器，把每间教室的用电算成一本公开账",
    repo: null, demo: null,
    created: "-15 days", updated: "-5 days",
    body: `学校总务处说，放学后的空教室里常常灯和空调全开。但「常常」是多少？我们想用数据说话。

方案很简单：在每间教室装一个人体存在传感器，记录「有人/无人」的时间线，再对照教室的灯和空调功率，估算出**每天浪费的度数和折算的碳排放**。

第一阶段先在两间教室试点。硬件已经装好，正在校准传感器的灵敏度——窗帘飘动偶尔会误报「有人」，这是目前最大的噪声来源。`,
    stacks: ["树莓派", "Python", "MQTT"],
    milestones: [["两间教室传感器安装", 1, 0], ["误报率降到 5% 以下", 1, 1], ["碳账本网页公开", 0, 2]],
    updates: [
      [jolly, "第二间教室的传感器上线了，数据开始进库。", 3],
      [jolly, "把误报过滤从阈值法换成了「连续 3 分钟无人」才算空教室，效果好很多。", 6],
    ],
    gap: null,
  },
  {
    slug: "poem-synth-wall", name: "会写诗的墙", domain: "creative", owner: xiaoman, featured: 1,
    tagline: "走廊里的一块屏幕：投进一个关键词，还你一首七言，和你写给它的那首一起上墙",
    repo: null, demo: "https://poem-wall.pages.dev",
    created: "-12 days", updated: "-2 days",
    body: `语文课学完律诗格律后，我们一直在想：能不能让人机各自写一首，**并排**挂在墙上，让来往的同学猜哪首是人写的？

屏幕就挂在教学楼三层的走廊。投进一个关键词（比如「秋雨」「晚自习」），机器用本地模型生成一首七言律诗；你也可以手写一首投上去，两首并排展示，落款不标作者。

目前收到 **63 份**人工投稿。猜对的概率大概是 55%——略好于瞎猜，但远低于大家以为的 90%。这个结果本身就很有意思。`,
    stacks: ["Vue", "Ollama", "E-Ink 屏"],
    milestones: [["走廊屏幕点亮", 1, 0], ["投稿与并排展示功能", 1, 1], ["学期末的「人机诗会」活动", 0, 2]],
    updates: [
      [xiaoman, "猜一猜的小投票上线了，63 份投稿里机器被认出来的只有一半多一点。", 2],
    ],
    gap: null,
  },
  {
    slug: "posture-reminder-cat", name: "坐姿提醒小猫", domain: "health", owner: zoom, featured: 0,
    tagline: "一只住在屏幕角落的猫：检测到你前倾久坐，它会回头看你",
    repo: null, demo: null,
    created: "-9 days", updated: "-1 day",
    body: `写代码久了脖子前倾，体检时被医生说「颈椎曲度变直」。市面上的提醒 App 太吵，我需要一个**不烦人**的提醒。

坐姿提醒小猫在本地跑姿态估计（摄像头画面**不出电脑**），检测到头部位移超过阈值且持续 10 分钟，屏幕角落里的小猫就会从趴着变成**回头看**你；连续回头三次还不改，才会弹一条通知。

桌面端的最小版本已经能用，目前在调「回头看」的阈值——太灵敏会变成打扰，太迟钝等于没有。`,
    stacks: ["Python", "MediaPipe", "Electron"],
    milestones: [["姿态检测原型", 1, 0], ["桌面小猫形象与动画", 1, 1], ["阈值调节面板", 0, 2]],
    updates: [
      [zoom, "小猫动画画好了，用的是 8 帧逐帧手绘，回头的那一下特意画慢了半拍。", 4],
    ],
    gap: null,
  },
];

db.exec("BEGIN");
try {
  for (const p of newProjects) {
    q(`INSERT INTO projects (slug, name, tagline, body, repo_url, demo_url, domain_id, status, owner_id, created_at, updated_at, featured)
       SELECT ?,?,?,?,?,?,?, 'approved', ?, datetime('now',?), datetime('now',?), ?
       WHERE NOT EXISTS (SELECT 1 FROM projects WHERE slug=?)`,
       p.slug, p.name, p.tagline, p.body, p.repo, p.demo, p.domain, p.owner, p.created, p.updated, p.featured, p.slug);
    const pid = one("SELECT id FROM projects WHERE slug=?", p.slug).id;
    q(`INSERT OR IGNORE INTO project_members (project_id, member_id, role) VALUES (?,?,'owner')`, pid, p.owner);
    for (const t of p.stacks) q(`INSERT OR IGNORE INTO project_stacks (project_id, tag) VALUES (?,?)`, pid, t);
    for (const [t, done, sort] of p.milestones)
      q(`INSERT INTO project_milestones (project_id, text, done, sort) SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM project_milestones WHERE project_id=? AND text=?)`, pid, t, done, sort, pid, t);
    for (const [author, text, days] of p.updates)
      q(`INSERT INTO project_updates (project_id, author_id, text, status, created_at)
         SELECT ?,?,?, 'approved', datetime('now','-' || ? || ' days')
         WHERE NOT EXISTS (SELECT 1 FROM project_updates WHERE project_id=? AND text=?)`, pid, author, text, days, pid, text);
    if (p.gap)
      q(`INSERT INTO project_gaps (project_id, label) SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM project_gaps WHERE project_id=? AND label=?)`, pid, p.gap, pid, p.gap);
  }

  // (a) weekly note column by admin, with hashtags feeding the topics column
  const weeklyNoteText = `## 本周数字

- 新增获批项目 **5** 个，覆盖全部六个方向
- 「会写诗的墙」收到人机诗稿 63 份
- 坐姿提醒小猫进入内测

## 值得试试

#AI工具 方向本周新增了本地小模型项目，值得围观；#校园项目 的两个硬件项目都在招募队友，详见项目页的「缺口」。

> 想让自己的项目进周报？给运营组留言即可。`;
  q(`INSERT INTO columns (slug, column_label, title, subtitle, author, author_title, text, kind, topics, published_at)
     SELECT 'demo-weekly-no2','社区投稿','星屿周报 · 第 2 期','开学第一个月，大家都在做什么','演示管理员','星屿运营组', ?, 'note', '#周报 #AI工具 #校园项目', date('now','-3 day')
     WHERE NOT EXISTS (SELECT 1 FROM columns WHERE slug='demo-weekly-no2')`, weeklyNoteText);

  // (b) showcase column by 林小满: mermaid + inline KaTeX + markdown table
  const showcaseText = `观察站跑到第 21 天了。这周我们把全部数据整理成了一个公开看板，任何人都能查到校门口这条河每天的变化。

## 数据怎么流起来的

\`\`\`mermaid
flowchart LR
    A[浊度传感器 每天 07:00 采样] --> B[(数据仓库)]
    B --> C[折线图看板]
    B --> D[雨后对比报告]
\`\`\`

## 我们拟合出的规律

雨量和浊度近似线性：$T = 3.1R + 12.4$，其中 $T$ 是浊度（NTU），$R$ 是前一日降雨量（mm）。大家都很熟悉那个更出名的公式 $e=mc^2$，但这个小公式是我们自己的。

## 三周的数据速览

| 周次 | 采样天数 | 平均浊度 (NTU) | 备注 |
|---|---|---|---|
| 第 1 周 | 7 | 13.2 | 以晴天为主 |
| 第 2 周 | 7 | 28.6 | 周三暴雨 |
| 第 3 周 | 7 | 14.8 | 基本恢复 |

> 数据已经同步给生物课的老师，报告正在写。想看原始数据的同学可以在项目页留言。`;
  q(`INSERT INTO columns (slug, column_label, title, subtitle, author, author_title, text, kind, published_at)
     SELECT 'demo-river-showcase','社区投稿','校园河流观察站 · 数据看板公开','第 21 天：我们把整条河的「体检报告」画了出来','林小满','星屿社区成员 · 校园河流观察站发起人', ?, 'showcase', date('now','-5 day')
     WHERE NOT EXISTS (SELECT 1 FROM columns WHERE slug='demo-river-showcase')`, showcaseText);

  // (c) article column by 陈以恒 about building a study tool, with hashtags
  const studyToolText = `我的错题本曾是一本只进不出的本子：抄的时候很认真，然后……就没有然后了。上学期数学失分的一半来自「错过的题又错」。

## 我做错了什么

抄错题本身没有复习效果，**间隔重复**才有。所以工具只做两件事：

1. 拍照存题，自动按知识点归档
2. 按 1 / 3 / 7 / 14 天的节奏把旧题重新推给我，做对了才放它「毕业」

## 三个周末的进度

第一个周末只做了拍照入库；第二个周末写了推送逻辑；第三个周末把「毕业」做成了一个小小的动画——看到题被划掉的那一刻确实爽。

## 给同样想开始的你

不要一开始就想做完美工具。先解决你自己最疼的那一个点。#学习方法 的核心是诚实面对自己不会的地方；#效率工具 只是帮你把这件事变得不那么难。

*—— 目前用户 1 人，但错题消灭率已经从 40% 提到 85%。*`;
  q(`INSERT INTO columns (slug, column_label, title, subtitle, author, author_title, text, kind, topics, published_at)
     SELECT 'demo-study-tool-notes','社区投稿','我用三个周末做了一个错题本工具','从「抄在本子上再也不看」到「每周自动复习」','陈以恒','星屿社区成员 · 初二', ?, 'article', '#学习方法 #效率工具', date('now','-8 day')
     WHERE NOT EXISTS (SELECT 1 FROM columns WHERE slug='demo-study-tool-notes')`, studyToolText);

  // two future events + rsvps
  q(`INSERT INTO activities (title, description, starts_at, location)
     SELECT '秋季项目路演 · 第二场','新学期五个新项目现场路演，导师和同伴投票选出「最想加入的项目」。带电脑，现场可试玩。', '2026-10-11 14:00', '少年学院报告厅'
     WHERE NOT EXISTS (SELECT 1 FROM activities WHERE title='秋季项目路演 · 第二场')`);
  q(`INSERT INTO activities (title, description, starts_at, location)
     SELECT '开源工作坊：给你的项目写一个 README','从「这是什么」到「怎么跑起来」：一小时写一个别人能看懂、愿意点 Star 的 README。请自带项目。', '2026-10-18 10:00', '线上'
     WHERE NOT EXISTS (SELECT 1 FROM activities WHERE title LIKE '开源工作坊%')`);
  q(`INSERT OR IGNORE INTO rsvps (activity_id, member_id)
     SELECT a.id, m.id FROM activities a, members m
     WHERE a.title='秋季项目路演 · 第二场' AND m.id IN (62,63,59)`);
  q(`INSERT OR IGNORE INTO rsvps (activity_id, member_id)
     SELECT a.id, m.id FROM activities a, members m
     WHERE a.title LIKE '开源工作坊%' AND m.id IN (62,63,59)`);

  // resources (status values match existing: available / coming_soon)
  q(`INSERT INTO resources (name, description, status)
     SELECT '导师一对一 Office Hour','每周三 19:30–21:00 开放预约，每人 20 分钟，讨论项目方向和卡点。在站内信里找运营组报名。','available'
     WHERE NOT EXISTS (SELECT 1 FROM resources WHERE name='导师一对一 Office Hour')`);
  q(`INSERT INTO resources (name, description, status)
     SELECT '共享 GPU 训练机时','社区共享的训练机时池正在筹备，首批面向视觉和本地模型项目开放申请，预计下月上线。','coming_soon'
     WHERE NOT EXISTS (SELECT 1 FROM resources WHERE name='共享 GPU 训练机时')`);

  // approved comments on the new columns
  const newCommentCols = [
    ["demo-weekly-no2", yiheng, "周报这个栏目好，建议以后固定放一个新项目入口。"],
    ["demo-river-showcase", yiheng, "拟合公式能跑出来说明样本够用了！我们云课堂也想这样公开数据。"],
    ["demo-river-showcase", jolly, "三周表格一目了然。传感器的成本清单方便分享一下吗？碳账本也想参考。"],
    ["demo-study-tool-notes", xiaoman, "错题「毕业」的动画听着就很解压，等开源了我第一个用。"],
  ];
  for (const [slug, author, text] of newCommentCols)
    q(`INSERT INTO comments (target_type, target_id, author_id, text, status, created_at)
       SELECT 'column', c.id, ?, ?, 'approved', datetime('now','-' || (abs(random()) % 30 + 2) || ' hours')
       FROM columns c WHERE c.slug=?
         AND NOT EXISTS (SELECT 1 FROM comments WHERE target_id=c.id AND author_id=? AND text=?)`, author, text, slug, author, text);

  // notifications: unread for 林小满 (bell dropdown) + admin queue pings
  const notifs = [
    [xiaoman, "作业提醒：「找一个你身边的 AI」还有 3 天截止，记得提交。", "course"],
    [xiaoman, "你的项目「校园河流观察站」有了新的关注者。", "general"],
    [xiaoman, "你的评论已通过审核，已公开展示。", "general"],
    [xiaoman, "你的作业已被批改：观察很细致，注意补充「边界情况」的分析。", "course"],
    [admin, "新的加入申请：1 位同学申请加入「作业搭子 Agent」，请处理。", "general"],
    [admin, "待审核项目：「坐姿提醒小猫」已提交上线申请，等待审核。", "announce"],
  ];
  for (const [mid, text, type] of notifs)
    q(`INSERT INTO notifications (member_id, text, type) SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE member_id=? AND text=?)`, mid, text, type, mid, text);

  // follow edges: 62/63 follow the new projects and each other
  const newProjectFollows = [
    ["homework-copilot-agent", yiheng], ["poem-synth-wall", yiheng],
    ["rural-math-bridge", xiaoman], ["classroom-carbon-ledger", xiaoman],
    ["posture-reminder-cat", jolly],
  ];
  for (const [slug, follower] of newProjectFollows)
    q(`INSERT OR IGNORE INTO project_follows (project_id, member_id)
       SELECT id, ? FROM projects WHERE slug=?`, follower, slug);
  q(`INSERT OR IGNORE INTO member_follows (followee_id, follower_id) VALUES (?,?)`, xiaoman, yiheng); // 以恒 follows 小满
  q(`INSERT OR IGNORE INTO member_follows (followee_id, follower_id) VALUES (?,?)`, yiheng, xiaoman); // 小满 follows 以恒
  q(`INSERT OR IGNORE INTO member_follows (followee_id, follower_id) VALUES (?,?)`, jolly, xiaoman);   // 小满 follows Jolly

  db.exec("COMMIT");
} catch (e) { db.exec("ROLLBACK"); throw e; }
console.log("demo enrichment round 2 installed: 5 projects, 3 columns (note/showcase/article), 2 events + rsvps, 2 resources, comments, notifications, follows");
