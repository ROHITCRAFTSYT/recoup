"use server";

import { redirect } from "next/navigation";
import { verifyLogin, createSession } from "@/lib/auth";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Email and password are required." };

  const user = await verifyLogin(email, password);
  if (!user) return { error: "Invalid email or password." };

  await createSession(user);
  redirect("/");
}
