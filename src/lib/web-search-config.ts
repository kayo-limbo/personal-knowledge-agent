export const WEB_SEARCH_MODES = ["auto", "always", "never"] as const;

export type WebSearchMode = (typeof WEB_SEARCH_MODES)[number];

export const WEB_SEARCH_MODE_OPTIONS: ReadonlyArray<{
  value: WebSearchMode;
  label: string;
  description: string;
}> = [
  { value: "auto", label: "自动联网", description: "需要最新信息时由 Agent 决定" },
  { value: "always", label: "强制联网", description: "本次回答至少搜索一次" },
  { value: "never", label: "禁止联网", description: "只使用模型和个人知识库" },
];

