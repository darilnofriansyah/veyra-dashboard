"use server";

import {
  DEMO_SESSION_COOKIE,
  DEMO_SESSION_VALUE
} from "@/lib/demo-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function login() {
  const cookieStore = await cookies();
  cookieStore.set(DEMO_SESSION_COOKIE, DEMO_SESSION_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
  redirect("/dashboard");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_SESSION_COOKIE);
  redirect("/");
}
