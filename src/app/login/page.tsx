import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { getI18n } from "@/lib/i18n/server";
import { dirFor } from "@/lib/i18n/translate";
import { LanguageSwitcher } from "@/components/language-switcher";
import { IconLandmark, IconShieldCheck, IconCoins, IconUsersGroup } from "@/components/icons";

const HIGHLIGHTS = [
  { icon: IconLandmark, key: "highlightArrondissements" as const },
  { icon: IconUsersGroup, key: "highlightCitizens" as const },
  { icon: IconCoins, key: "highlightRevenue" as const },
  { icon: IconShieldCheck, key: "highlightSecurity" as const },
];

export default async function LoginPage() {
  const { locale, dict, t } = await getI18n();
  const dir = dirFor(locale);

  return (
    <div className="flex min-h-screen">
      {/* Panneau institutionnel — masque sur petit ecran, la connexion reste
          utilisable seule sur mobile/tablette. */}
      <div
        className="relative hidden w-[44%] flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:w-[38%]"
        style={{ background: "linear-gradient(150deg, var(--color-primary-dark), var(--color-primary) 55%, #156ab0)" }}
        dir={dir}
        lang={locale}
      >
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "rgb(200 161 58 / 0.22)" }}
        />

        <div className="relative flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-sm font-bold ring-1 ring-white/25 backdrop-blur-sm"
          >
            SM
          </div>
          <div className="text-sm font-semibold uppercase tracking-[0.14em] text-white/80">SIGEC-SM</div>
        </div>

        <div className="relative">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            {t("login.brandTitle")}
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/75">{t("login.brandSubtitle")}</p>

          <ul className="mt-10 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, key }) => (
              <li key={key} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/12 ring-1 ring-white/20">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm text-white/85">{t(`login.${key}`)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">{t("login.brandFooter")}</p>
      </div>

      {/* Panneau de connexion */}
      <div className="flex flex-1 items-center justify-center bg-[var(--color-bg)] px-6 py-10">
        <div className="w-full max-w-sm" dir={dir} lang={locale}>
          <div className="mb-6 flex items-center justify-between lg:justify-end">
            <div className="flex items-center gap-2 lg:hidden">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
                style={{ background: "var(--gradient-primary)" }}
              >
                SM
              </div>
              <span className="text-sm font-semibold text-[var(--color-text)]">SIGEC-SM</span>
            </div>
            <LanguageSwitcher locale={locale} />
          </div>

          <div className="mb-6 hidden text-center lg:block">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("login.welcomeBack")}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t("login.subtitle")}</p>
          </div>
          <div className="mb-6 text-center lg:hidden">
            <p className="text-sm text-[var(--color-text-muted)]">{t("login.subtitle")}</p>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-md sm:p-7">
            <Suspense fallback={null}>
              <LoginForm dict={dict} />
            </Suspense>
          </div>
          <p className="mt-6 text-center text-xs text-[var(--color-text-muted)]">{t("login.footer")}</p>
        </div>
      </div>
    </div>
  );
}
