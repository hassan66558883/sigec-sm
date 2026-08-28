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
      <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full blur-3xl"
        style={{ background: "rgb(200 161 58 / 0.22)" }}
      />

      <div className="relative w-full max-w-sm" dir={dir} lang={locale}>
        <div className="mb-4 flex justify-center">
          <LanguageSwitcher locale={locale} variant="onDark" />
        </div>

        <div className="mb-8 text-center text-white">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 text-lg font-bold ring-1 ring-white/25 backdrop-blur-sm">
            SM
          </div>
          <h1 className="text-2xl font-semibold leading-tight tracking-tight">{t("login.brandTitle")}</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/75">{t("login.brandSubtitle")}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[var(--color-surface)] p-6 shadow-2xl sm:p-7">
          <div className="mb-5 text-center">
            <h2 className="text-base font-semibold text-[var(--color-text)]">{t("login.welcomeBack")}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t("login.subtitle")}</p>
          </div>
          <Suspense fallback={null}>
            <LoginForm dict={dict} />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-white/60">{t("login.footer")}</p>
      </div>
    </div>
  );
}
