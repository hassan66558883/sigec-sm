// Envoi de SMS (module paiement en ligne, section 14). Aucun fournisseur SMS
// n'est contractualise a ce stade — meme reserve que pour les notifications
// e-mail (voir schema.prisma, modeles Notification/StaffNotification).
// Cette fonction ne DOIT jamais pretendre avoir envoye un message : elle
// journalise l'intention et renvoie sent:false tant qu'aucun fournisseur
// reel n'est branche. Brancher un operateur = remplacer le corps de cette
// fonction, sans toucher aux appelants (services/online-payments.ts...).
// Masque le numero (ne garde que les 4 derniers chiffres) avant de le
// journaliser — un numero de telephone est une donnee personnelle, meme
// dans un log de debogage (voir audit securite 2026-09-04 : ce log
// affichait auparavant le numero et le contenu du message en clair).
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 4 ? `***${digits.slice(-4)}` : "***";
}

export async function sendSms(to: string, message: string): Promise<{ sent: boolean; reason?: string }> {
  if (!to?.trim()) return { sent: false, reason: "Numero de telephone manquant." };
  console.log(`[SMS non envoye — aucun fournisseur configure] to=${maskPhone(to)} messageLength=${message.length}`);
  return { sent: false, reason: "Aucun fournisseur SMS configure." };
}
