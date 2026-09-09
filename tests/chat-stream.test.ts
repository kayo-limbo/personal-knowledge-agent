import assert from "node:assert/strict";
import test from "node:test";
import { consumeChatSse } from "../src/lib/chat-stream.ts";
import { loginSchema } from "../src/lib/validators/auth.ts";

function response(text: string, split = false) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) {
    if (split) for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    else controller.enqueue(bytes);
    controller.close();
  } }));
}

test("SSE 跨字节中文、CRLF、心跳和多帧都能重组，done 才完成", async () => {
  const events: unknown[] = [];
  await consumeChatSse(response(': ping\r\n\r\ndata: {"type":"delta","text":"你好"}\r\n\r\ndata: {"type":"done"}\r\n\r\n', true), e => events.push(e));
  assert.deepEqual(events, [{ type: "delta", text: "你好" }, { type: "done" }]);
});

test("SSE 未收到 done、半帧和非法事件不能冒充成功", async () => {
  for (const text of ['', 'data: {"type":"delta","text":"部分"}\n\n', 'data: {"type":"done"}', 'data: {"type":"delta","text":3}\n\n']) {
    await assert.rejects(consumeChatSse(response(text), () => {}));
  }
});

test("SSE 服务端 error 保留中文错误且停止消费", async () => {
  await assert.rejects(consumeChatSse(response('data: {"type":"error","message":"配额不足"}\n\n'), () => {}), /配额不足/);
});

test("登录输入拒绝非字符串并保留已有本地演示账号兼容性", () => {
  assert.equal(loginSchema.safeParse({email: [], password: {}}).success, false);
  assert.equal(loginSchema.safeParse({email: 'admin@example.com', password: 'x'.repeat(65)}).success, false);
  assert.equal(loginSchema.parse({email: ' ADMIN@example.com ', password: 'demo'}).email, 'admin@example.com');
});
