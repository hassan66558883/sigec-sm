// Politique de mot de passe (module securite, section 2) — un seul point
// de verification partage par toute creation/changement de mot de passe
// (createUser, reset-password, resetUserPasswordByAdmin, inscription
// citoyenne) plutot que des regles dupliquees et potentiellement
// divergentes a chaque site d'appel.
export function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < 10) {
    return "Le mot de passe doit contenir au moins 10 caracteres.";
  }
  if (!/[a-z]/.test(password)) return "Le mot de passe doit contenir au moins une minuscule.";
  if (!/[A-Z]/.test(password)) return "Le mot de passe doit contenir au moins une majuscule.";
  if (!/[0-9]/.test(password)) return "Le mot de passe doit contenir au moins un chiffre.";
  return null;
}
