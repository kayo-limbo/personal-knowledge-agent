import { z } from "zod";

/** 客户端资源 id 只用于定位候选记录，真正权限仍由服务端查询条件决定。 */
export const resourceIdSchema = z
  .string()
  .trim()
  .min(1, "记录 id 缺失")
  .max(128, "记录 id 格式不正确");
