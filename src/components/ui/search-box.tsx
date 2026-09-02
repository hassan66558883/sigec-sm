// Recherche GET server-rendered — meme motif que celui deja utilise sur
// /admin/citizens, generalise pour les autres listes (Phase "recherche
// globale" : permet aux resultats de recherche globale de pointer vers une
// liste deja filtree plutot que la liste brute).
export function SearchBox({ defaultValue, placeholder = "Rechercher..." }: { defaultValue?: string; placeholder?: string }) {
  return (
    <form className="flex gap-2">
      <input
        type="search"
        name="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-72 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
      />
      <button type="submit" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)]">
        Rechercher
      </button>
    </form>
  );
}
