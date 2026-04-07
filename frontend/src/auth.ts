import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { SignJWT } from "jose";

const backendSecret = new TextEncoder().encode(process.env.AUTH_SECRET!);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    async jwt({ token, account }) {
      // Generate a backend-compatible HS256 JWT on first sign-in
      if (account) {
        token.backendToken = await new SignJWT({ sub: token.sub! })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("30d")
          .sign(backendSecret);
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.backendToken) session.backendToken = token.backendToken as string;
      return session;
    },
  },
});
