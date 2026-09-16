/**
 * 这个文件只包含可以公开给浏览器的模型元数据，不包含 API Key。
 * 前后端共用同一份白名单，避免模型名称散落在多个文件里。
 */
export const DEEPSEEK_MODELS = ["deepseek-flash", "deepseek-v4-pro"] as const;
export type DeepSeekModel = (typeof DEEPSEEK_MODELS)[number];

export const DEFAULT_DEEPSEEK_MODEL: DeepSeekModel = "deepseek-flash";

/** 兼容旧页面和已有 Render 环境配置，但请求上游统一使用官方现行名称。 */
export function normalizeDeepSeekModel(value: unknown): unknown {
  return value === "deepseek-v4-flash" ? DEFAULT_DEEPSEEK_MODEL : value;
}

export function resolveDeepSeekModel(value: unknown): DeepSeekModel {
  const normalized = normalizeDeepSeekModel(value);
  return isDeepSeekModel(normalized) ? normalized : DEFAULT_DEEPSEEK_MODEL;
}

export const DEEPSEEK_MODEL_OPTIONS: ReadonlyArray<{
  value: DeepSeekModel;
  label: string;
  description: string;
}> = [
  { value: "deepseek-flash", label: "V4.1 Flash", description: "日常问答与工具调用" },
  { value: "deepseek-v4-pro", label: "V4 Pro", description: "保留的 Pro 模型" },
];

export const DEEPSEEK_THINKING_MODES = ["disabled", "enabled"] as const;
export type DeepSeekThinkingMode = (typeof DEEPSEEK_THINKING_MODES)[number];

export function isDeepSeekModel(value: unknown): value is DeepSeekModel {
  return typeof value === "string" && DEEPSEEK_MODELS.some((model) => model === value);
}
