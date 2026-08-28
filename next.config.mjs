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
        ],
      },
    ];
  },
};

export default nextConfig;
