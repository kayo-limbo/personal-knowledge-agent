/**
 * 这个文件只包含可以公开给浏览器的模型元数据，不包含 API Key。
 * 前后端共用同一份白名单，避免模型名称散落在多个文件里。
 */
export const DEEPSEEK_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro"] as const;
export type DeepSeekModel = (typeof DEEPSEEK_MODELS)[number];

export const DEFAULT_DEEPSEEK_MODEL: DeepSeekModel = "deepseek-v4-flash";

export const DEEPSEEK_MODEL_OPTIONS: ReadonlyArray<{
  value: DeepSeekModel;
  label: string;
  description: string;
}> = [
  { value: "deepseek-v4-flash", label: "V4 Flash", description: "速度快、成本低" },
  { value: "deepseek-v4-pro", label: "V4 Pro", description: "复杂任务效果更好" },
];

export const DEEPSEEK_THINKING_MODES = ["disabled", "enabled"] as const;
export type DeepSeekThinkingMode = (typeof DEEPSEEK_THINKING_MODES)[number];

export function isDeepSeekModel(value: unknown): value is DeepSeekModel {
  return typeof value === "string" && DEEPSEEK_MODELS.some((model) => model === value);
}
