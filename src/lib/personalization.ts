import { z } from "zod";

export const preferencesSchema = z.object({
  theme: z.enum(["system", "light", "dark"]),
  avatar: z.enum(["initial", "cat", "fox", "panda", "leaf", "planet"]),
  background: z.enum(["default", "sand", "sage", "ocean", "aurora", "paper"]),
  overlay: z.number().int().min(0).max(80),
}).strict();
export type Preferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences: Preferences = { theme: "system", avatar: "initial", background: "default", overlay: 30 };
export const profileSchema = z.object({ name: z.string().trim().min(1, "请输入昵称").max(40, "昵称最多 40 个字符"), preferences: preferencesSchema }).strict();
export function readPreferences(value: unknown): Preferences {
  const parsed = preferencesSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultPreferences;
}
export const avatars = { initial: "首字母", cat: "🐱", fox: "🦊", panda: "🐼", leaf: "🌱", planet: "🪐" };
export const backgrounds = { default: "跟随主题", sand: "暖沙", sage: "鼠尾草", ocean: "雾蓝", aurora: "柔和极光", paper: "纸张纹理" };
