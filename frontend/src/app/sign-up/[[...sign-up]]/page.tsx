import { redirect } from "next/navigation";

// GitHub OAuth handles sign-up automatically — redirect to sign-in
export default function SignUpPage() {
  redirect("/sign-in");
}
