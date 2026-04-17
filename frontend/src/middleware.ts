import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  // Auth is optional — the app works fully offline/locally without a session.
  // Only redirect to sign-in for routes that explicitly require a backend account.
  void req;
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
