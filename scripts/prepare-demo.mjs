// 本地 Compose 专用，显式准备人工演示数据；不录屏、不连接 Neon。
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const base = 'http://localhost:3000';
const credentialsPath = '.env.acceptance-demo.json';
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const sql = query => execFileSync('docker', ['compose', '--env-file', '.env.docker', 'exec', '-T', 'postgres', 'sh', '-c', 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -t -A'], { input: query, encoding: 'utf8', windowsHide: true }).trim();
const credentials = fs.existsSync(credentialsPath) ? JSON.parse(fs.readFileSync(credentialsPath, 'utf8')) : { base };
if (credentials.base !== base) throw new Error('账号文件不是本地环境配置');

async function prepareAccount(key, email, name, role) {
  if (!credentials[key]) {
    const password = randomUUID() + '!Aa1';
    const response = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, name }) });
    if (response.status !== 201) throw new Error(`演示账号 ${email} 创建失败；若账号已存在，不会重置密码，请先核对。`);
    const { id } = await response.json(); credentials[key] = { id, email, password };
    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
    if (role === 'ADMIN') sql(`UPDATE "User" SET role='ADMIN' WHERE id=${quote(id)};`);
  }
  const account = credentials[key];
  if (!/^[a-z0-9]+$/i.test(account.id) || sql(`SELECT count(*) FROM "User" WHERE id=${quote(account.id)} AND email=${quote(account.email)};`) !== '1') throw new Error('本地演示账号不匹配，不覆盖原数据');
  return account;
}

function ensureKnowledge(userId, title, content, tags) {
  sql(`INSERT INTO "KnowledgeDoc" (id,title,content,tags,source,"userId","updatedAt") SELECT ${quote('demo-' + randomUUID())},${quote(title)},${quote(content)},${quote(tags)},'manual',${quote(userId)},NOW() WHERE NOT EXISTS (SELECT 1 FROM "KnowledgeDoc" WHERE "userId"=${quote(userId)} AND title=${quote(title)});`);
}

const admin = await prepareAccount('admin', 'summer-assessment@example.com', '暑期验收演示', 'ADMIN');
const viewer = await prepareAccount('viewer', 'summer-viewer@example.com', '隔离验证用户', 'USER');
ensureKnowledge(admin.id, '星河项目验收安排', '星河项目是本演示使用的虚构项目。验收日期为2026年9月13日，演示时长8分钟。核心流程是登录、检索个人知识、引用来源和刷新后继续会话。负责人是林同学。验收前一天确认线上环境，提前准备本地 Docker 备用。', '星河项目,验收,计划');
ensureKnowledge(admin.id, '星河项目技术决策', '星河项目使用 Next.js、PostgreSQL 和 DeepSeek。当前采用关键词知识检索，不使用向量数据库。Agent 最多4轮模型请求、3次本地工具调用，总超时50秒。线上运行在Render Singapore Docker，数据库在Neon Singapore。API Key仅在服务端。', '星河项目,架构,Agent');
ensureKnowledge(admin.id, '星河项目演示故障预案', '公网不可用时切换本地 Docker Compose。联网搜索失败时选择禁止联网，使用已准备的个人知识问答。AI服务不可用时展示已持久化的会话并讲解代码。不要临时删除数据库volume或重新seed生产账号。', '星河项目,演示,预案');
ensureKnowledge(viewer.id, '隔离验证：我的独立笔记', '这条笔记仅属于隔离验证用户。此账号没有星河项目的验收安排、技术决策和故障预案。', '隔离验证');
sql(`INSERT INTO "Prompt" (id,title,content,"userId",favorite) SELECT ${quote('demo-' + randomUUID())},'验收讲解助手','请先给出简短结论，再用列表解释依据。涉及星河项目时先检索知识库并保留引用。不知道的内容明确说不知道。',${quote(admin.id)},true WHERE NOT EXISTS (SELECT 1 FROM "Prompt" WHERE "userId"=${quote(admin.id)} AND title='验收讲解助手');`);
console.log('Ready: local ADMIN + USER demo accounts, 3 project knowledge entries + 1 isolated note, 1 Prompt.');
console.log('Credentials: .env.acceptance-demo.json (Git ignored). Existing passwords and matching content were not overwritten.');
