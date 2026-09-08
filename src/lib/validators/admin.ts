import { z } from "zod";

export const managedUserRoleSchema = z.enum(["ADMIN", "USER", "GUEST"], {
  error: "用户角色不合法",
});
