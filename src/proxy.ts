import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { CITIZEN_SESSION_COOKIE, verifyCitizenSessionToken } from "@/lib/citizen-auth";
import { prisma } from "@/lib/db";
import { CSRF_COOKIE, CSRF_HEADER } from "@/lib/csrf";
import { csrfTokensMatch, generateCsrfToken, isCsrfExempt, requiresCsrfCheck } from "@/lib/csrf-server";

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

  // CSRF (double-submit cookie, voir lib/csrf.ts) : verifie EN PREMIER, avant
  // toute logique de session/RBAC — une requete sans jeton CSRF valide est
  // rejetee immediatement, pas la peine d'aller jusqu'a Prisma pour ca. Le
  // jeton lui-meme est pose plus bas (ensureCsrfCookie), sur toute reponse,
  // y compris les simples GET de page — il doit deja etre present cote
  // navigateur au moment ou l'utilisateur soumet le premier formulaire
  // (connexion, inscription...).
  if (pathname.startsWith("/api/") && requiresCsrfCheck(req.method) && !isCsrfExempt(pathname)) {
    const cookieValue = req.cookies.get(CSRF_COOKIE)?.value;
    const headerValue = req.headers.get(CSRF_HEADER);
    if (!csrfTokensMatch(cookieValue, headerValue)) {
      return NextResponse.json({ error: "Jeton CSRF manquant ou invalide." }, { status: 403 });
    }
  }

  let response: NextResponse | null = null;

  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const session = token ? await verifySessionToken(token) : null;
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("next", pathname);
      response = NextResponse.redirect(loginUrl);
    } else if (pathname !== "/admin/reset-password") {
      const user = await prisma.user.findUnique({
        where: { id: session.sub },
        select: { mustResetPwd: true, isActive: true },
      });
      if (!user || !user.isActive) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("next", pathname);
        response = NextResponse.redirect(loginUrl);
      } else if (user.mustResetPwd) {
        response = NextResponse.redirect(new URL("/admin/reset-password", req.url));
      }
    }
  }

  if (!response && pathname === "/login") {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const session = token ? await verifySessionToken(token) : null;
    if (session) {
      response = NextResponse.redirect(new URL("/admin", req.url));
    }
  }

  if (!response && pathname.startsWith("/portail") && pathname !== "/portail/login" && pathname !== "/portail/register") {
    const token = req.cookies.get(CITIZEN_SESSION_COOKIE)?.value;
    const session = token ? await verifyCitizenSessionToken(token) : null;
    if (!session) {
      response = NextResponse.redirect(new URL("/portail/login", req.url));
    }
  }

  if (!response && (pathname === "/portail/login" || pathname === "/portail/register")) {
    const token = req.cookies.get(CITIZEN_SESSION_COOKIE)?.value;
    const session = token ? await verifyCitizenSessionToken(token) : null;
    if (session) {
      response = NextResponse.redirect(new URL("/portail", req.url));
    }
  }

  if (!response) {
    response = NextResponse.next();
  }

  ensureCsrfCookie(req, response);
  return response;
}

// Pose le cookie CSRF s'il n'existe pas deja (premiere visite, ou cookie
// expire/efface). Non-httpOnly par conception : le JS du site doit pouvoir
// le lire pour le recopier dans l'en-tete X-CSRF-Token (voir
// components/csrf-init.tsx).
function ensureCsrfCookie(req: NextRequest, response: NextResponse) {
  if (req.cookies.get(CSRF_COOKIE)?.value) return;
  response.cookies.set(CSRF_COOKIE, generateCsrfToken(), {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export const config = {
  // Volontairement large (toutes les pages, pas seulement /admin, /login,
  // /portail) : le cookie CSRF doit exister avant la toute premiere requete
  // mutante de l'utilisateur, quelle que soit la page par laquelle il entre
  // dans le site (ex. une page publique non listee ici plus tard). Exclut
  // uniquement les assets statiques, jamais concernes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
