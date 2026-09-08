export const DEFAULT_DAILY_USER_CHAT_LIMIT = 20;
export const DEFAULT_DAILY_GLOBAL_CHAT_LIMIT = 60;
const MAX_CONFIGURED_DAILY_LIMIT = 10_000;

export interface ChatQuotaConfig {
  userLimit: number;
  globalLimit: number;
}

export type ChatQuotaScope = "user" | "global";

export class ChatQuotaExceededError extends Error {
  readonly scope: ChatQuotaScope;
  readonly limit: number;
  readonly retryAfterSeconds: number;

  constructor(
    scope: ChatQuotaScope,
    limit: number,
    retryAfterSeconds: number
  ) {
    super(scope === "user" ? "用户今日聊天次数已达上限" : "今日全站演示额度已用完");
    this.name = "ChatQuotaExceededError";
    this.scope = scope;
    this.limit = limit;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= MAX_CONFIGURED_DAILY_LIMIT
    ? parsed
    : fallback;
}

/** 无效配置回退到安全默认值，不能因拼写错误意外关闭费用保护。 */
export function getChatQuotaConfig(
  env?: Partial<Record<"CHAT_DAILY_USER_LIMIT" | "CHAT_DAILY_GLOBAL_LIMIT", string>>
): ChatQuotaConfig {
  const source = env ?? process.env;
  return {
    userLimit: readPositiveInteger(
      source.CHAT_DAILY_USER_LIMIT,
      DEFAULT_DAILY_USER_CHAT_LIMIT
    ),
    globalLimit: readPositiveInteger(
      source.CHAT_DAILY_GLOBAL_LIMIT,
      DEFAULT_DAILY_GLOBAL_CHAT_LIMIT
    ),
  };
}

/** 配额按 UTC 自然日存储，避免应用实例和数据库时区不同导致重复桶。 */
export function getUtcQuotaDate(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function getQuotaRetryAfterSeconds(now: Date): number {
  const nextDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  return Math.max(1, Math.ceil((nextDay.getTime() - now.getTime()) / 1000));
}

export function assertChatQuotaAvailable(
  userCount: number,
  globalCount: number,
  config: ChatQuotaConfig,
  now: Date
): void {
  const retryAfterSeconds = getQuotaRetryAfterSeconds(now);
  if (userCount >= config.userLimit) {
    throw new ChatQuotaExceededError("user", config.userLimit, retryAfterSeconds);
  }
  if (globalCount >= config.globalLimit) {
    throw new ChatQuotaExceededError("global", config.globalLimit, retryAfterSeconds);
  }
}
