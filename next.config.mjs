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
          // CSP (absente jusqu'ici — voir audit securite 2026-09-02).
          // `style-src 'unsafe-inline'` reste necessaire : l'app utilise
          // massivement des attributs `style={{...}}` inline (degrades de
          // couleur, notamment) plutot que des classes statiques — les
          // retirer serait un chantier separe, pas un correctif ponctuel.
          // Pas de `script-src 'unsafe-inline'` en revanche : aucun script
          // inline n'est utilise dans l'app (verifie), donc pas necessaire.
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
