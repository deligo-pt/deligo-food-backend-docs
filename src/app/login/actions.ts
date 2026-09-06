"use server";

import { redirect } from "next/navigation";
import { authConfigured, checkPassword, endSession, startSession } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-redirect";

export interface LoginState {
  error?: string;
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!authConfigured()) {
    return { error: "Authentication is not configured on this server." };
  }

  const password = formData.get("password");
  const next = safeNextPath(
    typeof formData.get("next") === "string"
      ? (formData.get("next") as string)
      : "/",
  );

  const valid = await checkPassword(password);
  // A small delay blunts online password guessing without a server-side store.
  await new Promise((resolve) => setTimeout(resolve, 220 + Math.random() * 200));

  if (!valid) {
    return { error: "Incorrect password." };
  }

  if (!(await startSession())) {
    return { error: "Authentication is not configured on this server." };
  }

  redirect(next);
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/login");
}
