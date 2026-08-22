import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIGEC-SM — Ville de N'Djamena",
  description:
    "Systeme Integre de Gestion de l'Etat Civil et des Services Municipaux de la Ville de N'Djamena",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
