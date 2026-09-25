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
