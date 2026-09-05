/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sortie autonome (server.js + seules les deps tracees, pas tout
  // node_modules) — necessaire pour empaqueter l'app dans le shell Electron
  // (voir electron/) sans embarquer des centaines de Mo inutiles. Sans effet
  // sur `next dev` ni sur le web classique servi via `next start`.
  output: "standalone",
  experimental: {
    // Active forbidden() (403 explicite pour "authentifie mais hors
    // perimetre territorial") — voir node_modules/next/dist/docs/.../forbidden.md
    authInterrupts: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // HSTS n'a d'effet que servi en HTTPS (le reverse proxy de
          // production doit terminer TLS) ; inoffensif en dev HTTP.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // Content-Security-Policy : PAS ici. Un header statique ne peut pas
          // porter de nonce (une valeur fixe au build, identique a chaque
          // requete, n'apporte aucune protection). Le CSP par nonce vit
          // desormais dans src/proxy.ts (voir son commentaire) — un premier
          // essai statique ici (`script-src 'self'` sans nonce ni
          // 'unsafe-inline') a bloque silencieusement toute l'hydratation
          // React de l'app du 2026-09-04 au 2026-09-05.
        ],
      },
    ];
  },
};

export default nextConfig;
