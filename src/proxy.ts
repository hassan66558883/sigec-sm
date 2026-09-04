import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { CITIZEN_SESSION_COOKIE, verifyCitizenSessionToken } from "@/lib/citizen-auth";
import { prisma } from "@/lib/db";
import { CSRF_COOKIE, CSRF_HEADER } from "@/lib/csrf";
import { csrfTokensMatch, generateCsrfToken, isCsrfExempt, requiresCsrfCheck } from "@/lib/csrf-server";
import { isRateLimited } from "@/lib/rate-limit";

// Filet de securite general pour TOUTE l'API (voir audit performance/
// securite 2026-09-02 : seules les 3 routes de connexion avaient une limite
// avant ce changement, les 100+ autres routes etaient totalement
// exposees). Volontairement genereux — un office d'arrondissement entier
// peut partager la meme IP publique/locale — pour ne jamais bloquer un
// usage legitime meme soutenu (recherche, pagination, exports repetes) ;
// vise l'abus/le flood scripte, pas la charge normale.
const API_RATE_WINDOW_MS = 60 * 1000;
const API_RATE_MAX_ATTEMPTS = 300;

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
  if (pathname.startsWith("/api/")) {
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
    if (isRateLimited(`api:${ipAddress}`, API_RATE_WINDOW_MS, API_RATE_MAX_ATTEMPTS)) {
      return NextResponse.json({ error: "Trop de requetes. Reessayez dans une minute." }, { status: 429 });
    }
  }

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
        response.cookies.delete(SESSION_COOKIE);
      } else if (user.mustResetPwd) {
        response = NextResponse.redirect(new URL("/admin/reset-password", req.url));
      }
    }
  }

  // "Deja connecte, redirige vers /admin" doit verifier la meme validite que
  // le garde /admin ci-dessus (utilisateur toujours existant/actif), pas
  // seulement la signature du jeton — sinon un compte desactive/supprime
  // pendant qu'une session est encore active provoque une boucle infinie :
  // /admin refuse (utilisateur invalide) -> /login accepte (signature
  // valide) -> /admin refuse -> ... jusqu'a effacement manuel du cookie.
  if (!response && pathname === "/login") {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const session = token ? await verifySessionToken(token) : null;
    const user = session
      ? await prisma.user.findUnique({ where: { id: session.sub }, select: { isActive: true } })
      : null;
    if (user && user.isActive) {
      response = NextResponse.redirect(new URL("/admin", req.url));
    } else if (session) {
      response = NextResponse.next();
      response.cookies.delete(SESSION_COOKIE);
    }
  }

  if (!response && pathname.startsWith("/portail") && pathname !== "/portail/login" && pathname !== "/portail/register") {
    const token = req.cookies.get(CITIZEN_SESSION_COOKIE)?.value;
    const session = token ? await verifyCitizenSessionToken(token) : null;
    const account = session
      ? await prisma.citizenAccount.findUnique({ where: { id: session.sub }, select: { isActive: true } })
      : null;
    if (!account || !account.isActive) {
      response = NextResponse.redirect(new URL("/portail/login", req.url));
      if (session) response.cookies.delete(CITIZEN_SESSION_COOKIE);
    }
  }

  // Meme raisonnement que pour /login ci-dessus (regle du meme bug pour le
  // realm citoyen).
  if (!response && (pathname === "/portail/login" || pathname === "/portail/register")) {
    const token = req.cookies.get(CITIZEN_SESSION_COOKIE)?.value;
    const session = token ? await verifyCitizenSessionToken(token) : null;
    const account = session
      ? await prisma.citizenAccount.findUnique({ where: { id: session.sub }, select: { isActive: true } })
      : null;
    if (account && account.isActive) {
      response = NextResponse.redirect(new URL("/portail", req.url));
    } else if (session) {
      response = NextResponse.next();
      response.cookies.delete(CITIZEN_SESSION_COOKIE);
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
