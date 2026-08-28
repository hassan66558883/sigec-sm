// Constantes CSRF client-safe (aucun import Node ici — voir ./csrf-server.ts
// pour la generation/verification du jeton, qui utilise crypto et ne doit
// jamais etre importe depuis un composant "use client").
export const CSRF_COOKIE = "csrf_token";
export const CSRF_HEADER = "x-csrf-token";
