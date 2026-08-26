import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { getI18n } from "@/lib/i18n/server";
import { dirFor } from "@/lib/i18n/translate";
import { LanguageSwitcher } from "@/components/language-switcher";

export default async function LoginPage() {
  const { locale, dict, t } = await getI18n();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-sm" dir={dirFor(locale)} lang={locale}>
        <div className="mb-4 flex justify-center">
          <LanguageSwitcher locale={locale} />
        </div>
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white shadow-sm"
            style={{ background: "var(--gradient-primary)" }}
          >
            SM
          </div>
          <h1 className="text-lg font-semibold text-[var(--color-text)]">SIGEC-SM</h1>
          <p className="text-sm text-[var(--color-text-muted)]">{t("login.subtitle")}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
          <Suspense fallback={null}>
            <LoginForm dict={dict} />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-[var(--color-text-muted)]">{t("login.footer")}</p>
      </div>
    </div>
  );
}
