import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { getI18n } from "@/lib/i18n/server";
import { dirFor } from "@/lib/i18n/translate";
import { LanguageSwitcher } from "@/components/language-switcher";

export default async function LoginPage() {
  const { locale, dict, t } = await getI18n();
  const dir = dirFor(locale);

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{ background: "linear-gradient(150deg, var(--color-primary-dark), var(--color-primary) 55%, #156ab0)" }}
    >
      {/* Formes floues en fond, derive lente (voir .login-blob, globals.css) —
          profondeur et mouvement ambiant sans jamais distraire de la saisie. */}
      <div
        aria-hidden
        className="login-blob pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-white/10 blur-3xl"
      />
      <div
        aria-hidden
        className="login-blob pointer-events-none absolute -bottom-40 -left-24 h-[26rem] w-[26rem] rounded-full blur-3xl"
        style={{ background: "rgb(200 161 58 / 0.25)", animationDelay: "-7s" }}
      />
      <div
        aria-hidden
        className="login-blob pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-white/5 blur-3xl"
        style={{ animationDelay: "-14s" }}
      />

      <div className="relative w-full max-w-md" dir={dir} lang={locale}>
        {/* Panneau de verre unique — logo, message institutionnel et
            formulaire dans un seul objet premium plutot que deux blocs
            empiles (voir recherche design : "centered modal cards ... feel
            like a discrete, premium object"). */}
        <div className="overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between px-7 pt-6 sm:px-9">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-sm font-bold text-white ring-1 ring-white/25">
                SM
              </div>
              <span className="text-sm font-semibold uppercase tracking-[0.14em] text-white/80">SIGEC-SM</span>
            </div>
            <LanguageSwitcher locale={locale} variant="onDark" />
          </div>

          <div className="px-7 pb-2 pt-6 text-center sm:px-9">
            <h1 className="text-xl font-semibold leading-tight tracking-tight text-white">{t("login.brandTitle")}</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/70">{t("login.brandSubtitle")}</p>
          </div>

          <div className="mx-7 my-6 h-px bg-white/15 sm:mx-9" />

          <div className="px-7 pb-8 sm:px-9">
            <div className="mb-5 text-center">
              <h2 className="text-sm font-semibold text-white">{t("login.welcomeBack")}</h2>
              <p className="mt-1 text-xs text-white/60">{t("login.subtitle")}</p>
            </div>
            <Suspense fallback={null}>
              <LoginForm dict={dict} />
            </Suspense>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/60">{t("login.footer")}</p>
      </div>
    </div>
  );
}
