// 仅测试本地 Compose；临时用户按精确 id 清理，不触碰已有账号。
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openBrowser } from './browser-session.mjs';
const base = 'http://localhost:3000';
const importFixture = path.resolve('docs/acceptance/demo-import-source.md');
const pdfFixture = path.join(os.tmpdir(), `pka-import-${randomUUID()}.pdf`);
const ids = [];
const quote = text => "'" + text.replaceAll("'", "''") + "'";
const sql = query => execFileSync('docker', ['compose', '--env-file', '.env.docker', 'exec', '-T', 'postgres', 'sh', '-c', 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -t -A'], { input: query, encoding: 'utf8', windowsHide: true }).trim();
function writeMinimalPdf(file) {
  const stream = 'BT /F1 18 Tf 72 720 Td (Linux PDF parser check) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let source = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(source)); source += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xrefOffset = Buffer.byteLength(source);
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('') + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  fs.writeFileSync(file, source);
}
async function account() {
  const email = `acceptance-${randomUUID()}@example.com`, password = randomUUID() + '!aA1';
  const response = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '验收临时用户', email, password }) });
  assert.equal(response.status, 201); const { id } = await response.json(); ids.push(id); return { id, email, password };
}

(async () => {
  let browser;
  try {
    writeMinimalPdf(pdfFixture);
    const user = await account(), other = await account();
    sql(`UPDATE "User" SET role='ADMIN' WHERE id=${quote(user.id)};`);
    browser = await openBrowser();
    const { evaluate, waitFor, fill, navigate, pause } = browser;
    await navigate(base + '/login', '!!document.querySelector("#email")');
    await fill('#email', user.email); await fill('#password', user.password);
    await evaluate('document.querySelector("button[type=submit]").click()');
    await waitFor('!!document.querySelector("aside nav")');
    // 捕获旧 Cookie 和旧管理员表单，降权后仍用原请求验证服务端拒绝。
    const cookies = await browser.call('Network.getCookies', { urls: [base] });
    const cookie = cookies.cookies.map(item => `${item.name}=${item.value}`).join('; ');
    await navigate(base + '/dashboard/admin/users', '!!document.querySelector("select[name=role]")');
    const staleForm = await evaluate(`(()=>{const form=[...document.querySelectorAll('form')].find(f=>f.querySelector('input[name=id]')?.value===${JSON.stringify(other.id)});return [...new FormData(form).entries()];})()`);
    sql(`UPDATE "User" SET role='USER' WHERE id=${quote(user.id)};`);
    let session = await (await fetch(base + '/api/auth/session', { headers: { cookie } })).json();
    assert.equal(session.user.role, 'USER');
    const form = new FormData(); for (const [key, value] of staleForm) form.append(key, value); form.set('role', 'ADMIN');
    const denied = await fetch(base + '/dashboard/admin/users', { method: 'POST', headers: { cookie, Origin: base }, body: form, redirect: 'manual' });
    assert.match(decodeURIComponent(denied.headers.get('location') || ''), /只有管理员/);
    assert.equal(sql(`SELECT role FROM "User" WHERE id=${quote(other.id)};`), 'USER');
    sql(`UPDATE "User" SET role='ADMIN' WHERE id=${quote(user.id)};`);
    session = await (await fetch(base + '/api/auth/session', { headers: { cookie } })).json(); assert.equal(session.user.role, 'ADMIN');
    console.log('PASS: old Cookie observes role changes; stale admin Action rejected.');

    await navigate(base + '/dashboard/knowledge', 'document.body.innerText.includes("导入文件")');
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('导入文件')).click()`);
    await waitFor('!!document.querySelector("input[type=file]")');
    const root = await browser.call('DOM.getDocument');
    const fileInput = await browser.call('DOM.querySelector', { nodeId: root.root.nodeId, selector: 'input[type=file]' });
    await browser.call('DOM.setFileInputFiles', { nodeId: fileInput.nodeId, files: [importFixture, pdfFixture] });
    await fill('input[name=tags]', '自动回归,灾备');
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('开始导入')).click()`);
    await waitFor('!!document.querySelector("[role=status], [role=alert]")', 60);
    const importFeedback = await evaluate('document.querySelector("[role=status], [role=alert]").innerText');
    assert.match(importFeedback, /已导入 2 个文件/);
    assert.equal(sql(`SELECT count(*) FROM "KnowledgeDoc" WHERE "userId"=${quote(user.id)} AND source='upload' AND title LIKE 'demo-import-source.md%';`), '1');
    assert.equal(sql(`SELECT count(*) FROM "KnowledgeDoc" WHERE "userId"=${quote(user.id)} AND source='upload' AND content LIKE '%Linux PDF parser check%';`), '1');
    console.log('PASS: Markdown and PDF imported through real browser and persisted as isolated upload chunks.');

    await navigate(base + '/dashboard/prompts', '!!document.querySelector("input[name=title]")');
    await fill('input[name=title]', '验收回答模板');
    await fill('textarea[name=content]', '每次回答第一行必须是：验收模板已生效。然后用中文简短回答用户。');
    await evaluate('document.querySelector("input[name=title]").closest("form").querySelector("button[type=submit]").click()');
    await waitFor('document.body.innerText.includes("Prompt 已创建")');
    const promptId = sql(`SELECT id FROM "Prompt" WHERE "userId"=${quote(user.id)};`);
    assert(promptId);
    const foreignId = 'foreign-' + randomUUID();
    sql(`INSERT INTO "Prompt" (id,title,content,"userId") VALUES (${quote(foreignId)},'他人模板','不应被使用',${quote(other.id)});`);
    const postChat = async body => fetch(base + '/api/chat', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await postChat({ content: 'test', promptId: foreignId })).status, 400);
    assert.equal(sql(`SELECT count(*) FROM "ChatQuota" WHERE "subjectId"=${quote(user.id)};`), '0');
    console.log('PASS: Prompt created through browser; foreign Prompt rejected before quota.');

    await navigate(base + '/dashboard/chat', '!!document.querySelector("textarea")');
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('新对话')).click()`);
    await fill('select[aria-label="选择聊天 Prompt"]', promptId);
    await fill('textarea', '请先调用 searchKnowledge。根据我导入的 Polaris Runbook，用 Markdown 列出 recovery target 和 code name。');
    await evaluate(`document.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,bubbles:true}))`);
    assert.equal(await evaluate('!!document.querySelector("button[aria-label=停止生成]")'), false);
    assert((await evaluate('document.querySelector("textarea").value')).length > 0);
    await evaluate('document.querySelector("button[aria-label=发送消息]").click()');
    await waitFor('document.querySelectorAll("article").length>=2 && !document.querySelector("button[aria-label=停止生成]")', 65);
    assert(await evaluate('document.body.innerText.includes("验收模板已生效")'));
    assert(await evaluate('!!document.querySelector("article ul")'));
    assert(await evaluate('document.body.innerText.includes("15") && document.body.innerText.includes("雪松")'));
    assert(await evaluate('document.body.innerText.includes("知识库来源") && document.body.innerText.includes("demo-import-source.md")'));
    const conversationId = sql(`SELECT id FROM "Conversation" WHERE "userId"=${quote(user.id)};`);
    assert.equal(sql(`SELECT "promptId" FROM "Conversation" WHERE id=${quote(conversationId)};`), promptId);
    assert.match(sql(`SELECT content FROM "Message" WHERE "conversationId"=${quote(conversationId)} AND role='assistant';`), /验收模板已生效/);
    await navigate(base + '/dashboard/chat?conversation=' + conversationId, '!!document.querySelector("textarea")');
    assert.equal(await evaluate(`document.querySelector('select[aria-label="选择聊天 Prompt"]').value`), promptId);
    assert.equal(await evaluate(`document.querySelector('select[aria-label="选择聊天 Prompt"]').disabled`), true);
    console.log('PASS: IME Enter does not send; real DeepSeek Prompt + imported-knowledge answer, citation and persistence.');

    // 用浏览器内受控响应验证异常 UI，不产生额外 DeepSeek 费用。
    await evaluate(`window.acceptanceOriginalFetch=window.fetch;window.fetch=async (...args)=>String(args[0])==='/api/chat'?new Response('data: {"type":"delta","text":"未完成片段"}\\n\\n',{headers:{'X-Conversation-Id':${JSON.stringify(conversationId)},'X-User-Message-Id':'test-user','X-Assistant-Message-Id':'test-assistant'}}):window.acceptanceOriginalFetch(...args)`);
    await fill('textarea', '断流测试'); await evaluate('document.querySelector("button[aria-label=发送消息]").click()');
    await waitFor('document.body.innerText.includes("连接提前结束")');
    await navigate(base + '/dashboard/chat', '!!document.querySelector("textarea")');
    await evaluate(`window.acceptanceAborted=false;window.acceptanceOriginalFetch=window.fetch;window.fetch=(...args)=>String(args[0])==='/api/chat'?new Promise((resolve,reject)=>args[1].signal.addEventListener('abort',()=>{window.acceptanceAborted=true;reject(new DOMException('Stopped','AbortError'));})):window.acceptanceOriginalFetch(...args)`);
    await fill('textarea', '停止测试'); await evaluate('document.querySelector("button[aria-label=发送消息]").click()');
    await waitFor('!!document.querySelector("button[aria-label=停止生成]")');
    await evaluate('document.querySelector("button[aria-label=停止生成]").click()');
    await waitFor('window.acceptanceAborted && !!document.querySelector("button[aria-label=发送消息]")');
    await fill('textarea', '离页测试'); await evaluate('window.acceptanceAborted=false;document.querySelector("button[aria-label=发送消息]").click()');
    await waitFor('!!document.querySelector("button[aria-label=停止生成]")');
    await evaluate(`document.querySelector('aside a[href="/dashboard/history"]').click()`);
    await waitFor('location.pathname==="/dashboard/history" && window.acceptanceAborted===true');
    console.log('PASS: premature EOF feedback, Stop button and navigation Abort.');

    await navigate(base + '/dashboard/history', '!!document.querySelector("form[role=search]")');
    await fill('select[aria-label="搜索范围"]', '/dashboard/history'); await fill('input[aria-label="搜索关键词"]', 'Polaris');
    await evaluate('document.querySelector("form[role=search] button").click()');
    await waitFor('location.search.includes("query=Polaris")');
    assert(await evaluate('document.body.innerText.includes("Polaris Runbook")'));
    await fill('select[aria-label="搜索范围"]', '/dashboard/knowledge'); await fill('input[aria-label="搜索关键词"]', '不存在 & 中文');
    await evaluate('document.querySelector("form[role=search] button").click()');
    await waitFor('location.pathname==="/dashboard/knowledge"');
    assert.equal(await evaluate('new URLSearchParams(location.search).get("query")'), '不存在 & 中文');
    console.log('PASS: both header search targets and Unicode query encoding.');

    await navigate(base + '/dashboard/prompts', '!!document.querySelector("article form")');
    await fill('article input[name=title]', '更新后的验收模板');
    await evaluate('document.querySelector("article form button[type=submit]").click()');
    await waitFor('document.body.innerText.includes("Prompt 已更新")');
    await evaluate('document.querySelector("article details").open=true;document.querySelector("article details button").click()');
    await waitFor('document.body.innerText.includes("Prompt 已删除")');
    assert.equal(sql(`SELECT count(*) FROM "Prompt" WHERE id=${quote(promptId)};`), '0');
    assert.equal(sql(`SELECT count(*) FROM "Conversation" WHERE id=${quote(conversationId)} AND "promptId" IS NULL;`), '1');
    console.log('PASS: Prompt update/delete and conversation unlink.');
    await pause(100);
  } finally {
    if (browser) await browser.close();
    fs.rmSync(pdfFixture, { force: true });
    if (ids.length) {
      const list = ids.map(quote).join(',');
      sql(`BEGIN; DELETE FROM "Message" WHERE "conversationId" IN (SELECT id FROM "Conversation" WHERE "userId" IN (${list})); DELETE FROM "Conversation" WHERE "userId" IN (${list}); DELETE FROM "Prompt" WHERE "userId" IN (${list}); DELETE FROM "KnowledgeDoc" WHERE "userId" IN (${list}); DELETE FROM "ChatQuota" WHERE scope='user' AND "subjectId" IN (${list}); DELETE FROM "User" WHERE id IN (${list}); COMMIT;`);
      console.log('Temporary test accounts and their records removed; global request count retained.');
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
