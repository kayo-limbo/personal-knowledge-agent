import assert from "node:assert/strict";
import test from "node:test";
import {
  ChatQuotaExceededError,
  DEFAULT_DAILY_GLOBAL_CHAT_LIMIT,
  DEFAULT_DAILY_USER_CHAT_LIMIT,
  assertChatQuotaAvailable,
  getChatQuotaConfig,
  getQuotaRetryAfterSeconds,
  getUtcQuotaDate,
} from "../src/lib/chat-quota.ts";

test("每日配额配置接受安全正整数并对无效值回退", () => {
  assert.deepEqual(getChatQuotaConfig({}), {
    userLimit: DEFAULT_DAILY_USER_CHAT_LIMIT,
    globalLimit: DEFAULT_DAILY_GLOBAL_CHAT_LIMIT,
  });
  assert.deepEqual(
    getChatQuotaConfig({ CHAT_DAILY_USER_LIMIT: "7", CHAT_DAILY_GLOBAL_LIMIT: "33" }),
    { userLimit: 7, globalLimit: 33 }
  );
  assert.deepEqual(
    getChatQuotaConfig({ CHAT_DAILY_USER_LIMIT: "0", CHAT_DAILY_GLOBAL_LIMIT: "unlimited" }),
    {
      userLimit: DEFAULT_DAILY_USER_CHAT_LIMIT,
      globalLimit: DEFAULT_DAILY_GLOBAL_CHAT_LIMIT,
    }
  );
});

test("UTC 日期桶和 Retry-After 在跨时区时保持一致", () => {
  const now = new Date("2026-09-08T23:59:30.250Z");
  assert.equal(getUtcQuotaDate(now).toISOString(), "2026-09-08T00:00:00.000Z");
  assert.equal(getQuotaRetryAfterSeconds(now), 30);
});

test("用户与全站任一达到上限都会拒绝，并优先返回用户原因", () => {
  const now = new Date("2026-09-08T12:00:00.000Z");
  const config = { userLimit: 2, globalLimit: 5 };
  assert.doesNotThrow(() => assertChatQuotaAvailable(1, 4, config, now));

  for (const [userCount, globalCount, scope] of [
    [2, 4, "user"],
    [1, 5, "global"],
    [2, 5, "user"],
  ] as const) {
    assert.throws(
      () => assertChatQuotaAvailable(userCount, globalCount, config, now),
      (error: unknown) =>
        error instanceof ChatQuotaExceededError &&
        error.scope === scope &&
        error.retryAfterSeconds === 43_200
    );
  }
});
