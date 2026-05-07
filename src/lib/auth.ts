import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { checkRateLimit, recordLoginAttempt } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const ip =
          request?.headers?.get("x-forwarded-for")?.split(",")[0].trim() ??
          request?.headers?.get("x-real-ip") ??
          "unknown";

        const rateCheck = await checkRateLimit(ip);
        if (!rateCheck.allowed) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (!user || !user.aktiv) {
          await recordLoginAttempt(ip, parsed.data.email, false);
          return null;
        }

        const valid = await bcrypt.compare(parsed.data.password, user.password);
        if (!valid) {
          await recordLoginAttempt(ip, parsed.data.email, false);
          return null;
        }

        await Promise.all([
          prisma.user.update({ where: { id: user.id }, data: { letzter_login: new Date() } }),
          recordLoginAttempt(ip, parsed.data.email, true),
        ]);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rolle: user.rolle as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          muss_pw_aendern: user.muss_pw_aendern as any,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.rolle = (user as any).rolle;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.muss_pw_aendern = (user as any).muss_pw_aendern;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).rolle = token.rolle as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).muss_pw_aendern = token.muss_pw_aendern as boolean;
      }
      return session;
    },
  },
});
