
import { auth } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div>
      <h1>欢迎, {session?.user?.name}</h1>
      <p>你的角色是: {session?.user?.role}</p>
    </div>
  );
}