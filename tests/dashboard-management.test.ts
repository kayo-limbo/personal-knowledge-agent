import assert from "node:assert/strict";
import test from "node:test";
import { managedUserRoleSchema } from "../src/lib/validators/admin.ts";
import { conversationTitleSchema } from "../src/lib/validators/conversation.ts";
import { promptInputSchema } from "../src/lib/validators/prompt.ts";
// Dashboard 聊天交互回归也由现有测试入口执行。
import "./chat-stream.test.ts";

test("Prompt 输入会去除首尾空白并限制必填内容", () => {
  const parsed = promptInputSchema.parse({
    title: "  知识助手  ",
    content: "  只根据知识库回答  ",
    favorite: true,
    isPublic: false,
  });
  assert.equal(parsed.title, "知识助手");
  assert.equal(parsed.content, "只根据知识库回答");
  assert.equal(promptInputSchema.safeParse({ ...parsed, content: "" }).success, false);
});

test("会话标题拒绝空值和超过 80 字符的输入", () => {
  assert.equal(conversationTitleSchema.safeParse("  ").success, false);
  assert.equal(conversationTitleSchema.safeParse("a".repeat(81)).success, false);
  assert.equal(conversationTitleSchema.parse("  夏令营计划  "), "夏令营计划");
});

test("管理员角色更新只接受系统定义的三种角色", () => {
  assert.equal(managedUserRoleSchema.safeParse("ADMIN").success, true);
  assert.equal(managedUserRoleSchema.safeParse("USER").success, true);
  assert.equal(managedUserRoleSchema.safeParse("GUEST").success, true);
  assert.equal(managedUserRoleSchema.safeParse("SUPER_ADMIN").success, false);
});
