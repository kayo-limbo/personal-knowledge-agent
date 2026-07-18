export const KNOWLEDGE_SOURCES = [
  { value: "manual", label: "手动创建" },
  { value: "upload", label: "文件上传" },
  { value: "conversation", label: "对话生成" },
] as const;

export const KNOWLEDGE_PAGE_SIZE = 10;

export const KNOWLEDGE_TITLE_MAX_LENGTH = 100;
export const KNOWLEDGE_CONTENT_MAX_LENGTH = 20000;

export const EMPTY_KNOWLEDGE_MESSAGE = "还没有知识条目,点击右上角新建一个吧";