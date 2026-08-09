import { z } from "zod";

/** 注册接口的服务端规则。浏览器校验只改善体验，安全边界始终在服务器。 */
export const registerSchema = z.object({
  name: z.string().trim().max(50, "昵称不能超过 50 个字符").optional(),
  email: z.string().trim().toLowerCase().email("请输入有效的邮箱地址"),
  password: z
    .string()
    .min(8, "密码至少需要 8 个字符")
    .max(64, "密码不能超过 64 个字符"),
});
