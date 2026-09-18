import assert from "node:assert/strict";
import test from "node:test";
import { defaultPreferences, profileSchema, readPreferences } from "../src/lib/personalization.ts";

test("个性化输入拒绝越权字段、未知背景和越界遮罩", () => {
  const valid = { name: " 小张 ", preferences: defaultPreferences };
  assert.equal(profileSchema.parse(valid).name, "小张");
  for (const extra of [{ userId: "other" }, { role: "ADMIN" }]) assert.equal(profileSchema.safeParse({ ...valid, ...extra }).success, false);
  for (const change of [{ background: "https://example.test/x" }, { overlay: -1 }, { overlay: 81 }, { overlay: 1.5 }, { theme: "unknown" }]) {
    assert.equal(profileSchema.safeParse({ ...valid, preferences: { ...defaultPreferences, ...change } }).success, false);
  }
  for (const name of ["", "   ", "字".repeat(41)]) assert.equal(profileSchema.safeParse({ ...valid, name }).success, false);
});
test("旧账号的空配置和损坏配置使用安全默认值", () => {
  for (const value of [{}, null, { theme: "dark" }, "invalid"]) assert.deepEqual(readPreferences(value), defaultPreferences);
  assert.equal(readPreferences({ ...defaultPreferences, theme: "dark" }).theme, "dark");
});

test("照片设置向后兼容，拒绝远程地址、SVG 和超限内容", () => {
  const legacy = { theme: "dark", avatar: "cat", background: "sage", overlay: 40 };
  const restored = readPreferences(legacy);
  assert.equal(restored.theme, "dark");
  assert.equal(restored.background, "sage");
  assert.equal(restored.avatarPhoto, null);
  for (const photo of ["https://example.test/photo.jpg", "data:image/svg+xml;base64,PHN2Zz4=", "data:image/jpeg;base64,invalid", "data:image/jpeg;base64,/9j/" + "A".repeat(450_000)]) {
    assert.equal(profileSchema.safeParse({ name: "用户", preferences: { ...defaultPreferences, backgroundPhoto: photo } }).success, false);
  }
});
