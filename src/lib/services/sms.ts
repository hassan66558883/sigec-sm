// Envoi de SMS (module paiement en ligne, section 14). Aucun fournisseur SMS
// n'est contractualise a ce stade — meme reserve que pour les notifications
// e-mail (voir schema.prisma, modeles Notification/StaffNotification).
// Cette fonction ne DOIT jamais pretendre avoir envoye un message : elle
// journalise l'intention et renvoie sent:false tant qu'aucun fournisseur
// reel n'est branche. Brancher un operateur = remplacer le corps de cette
// fonction, sans toucher aux appelants (services/online-payments.ts...).
export async function sendSms(to: string, message: string): Promise<{ sent: boolean; reason?: string }> {
  if (!to?.trim()) return { sent: false, reason: "Numero de telephone manquant." };
  console.log(`[SMS non envoye — aucun fournisseur configure] to=${to} message=${message}`);
  return { sent: false, reason: "Aucun fournisseur SMS configure." };
}
