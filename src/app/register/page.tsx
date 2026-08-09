import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "注册 | Personal Knowledge Agent" };

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  return <RegisterForm />;
}
