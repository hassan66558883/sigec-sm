import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { CITIZEN_SESSION_COOKIE, verifyCitizenSessionToken } from "@/lib/citizen-auth";
import { prisma } from "@/lib/db";

// Proxy tourne en runtime Node.js par defaut sur cette version de Next.js
// (voir node_modules/next/dist/docs/.../proxy.md) : contrairement a
// l'ancien Middleware Edge, l'acces a Prisma est donc possible ici. On
// s'en sert uniquement pour la verification de session + le blocage
// mustResetPwd, qui doit s'appliquer meme en navigation cote client (Link) —
// un simple redirect dans le layout ne suffit pas car le segment peut etre
// resolu depuis le cache RSC sans re-executer la verification.
// Le reste (RBAC fin, perimetre territorial) reste dans les Server
// Components/route handlers via getCurrentUser().
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const session = token ? await verifySessionToken(token) : null;
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (pathname !== "/admin/reset-password") {
      const user = await prisma.user.findUnique({
        where: { id: session.sub },
        select: { mustResetPwd: true, isActive: true },
      });
      if (!user || !user.isActive) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(loginUrl);
      }
      if (user.mustResetPwd) {
        return NextResponse.redirect(new URL("/admin/reset-password", req.url));
      }
    }
  }

  if (pathname === "/login") {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const session = token ? await verifySessionToken(token) : null;
    if (session) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
  }

  if (pathname.startsWith("/portail") && pathname !== "/portail/login" && pathname !== "/portail/register") {
    const token = req.cookies.get(CITIZEN_SESSION_COOKIE)?.value;
    const session = token ? await verifyCitizenSessionToken(token) : null;
    if (!session) {
      return NextResponse.redirect(new URL("/portail/login", req.url));
    }
  }

  if (pathname === "/portail/login" || pathname === "/portail/register") {
    const token = req.cookies.get(CITIZEN_SESSION_COOKIE)?.value;
    const session = token ? await verifyCitizenSessionToken(token) : null;
    if (session) {
      return NextResponse.redirect(new URL("/portail", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login", "/portail/:path*"],
};
