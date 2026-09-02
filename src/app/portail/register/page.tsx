import Link from "next/link";
import { RegisterForm } from "./register-form";

export default function CitizenRegisterPage() {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{ background: "linear-gradient(150deg, var(--color-primary-dark), var(--color-primary) 55%, #156ab0)" }}
    >
      <div aria-hidden className="login-blob pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-white/10 blur-3xl" />
      <div
        aria-hidden
        className="login-blob pointer-events-none absolute -bottom-40 -left-24 h-[26rem] w-[26rem] rounded-full blur-3xl"
        style={{ background: "rgb(200 161 58 / 0.25)", animationDelay: "-7s" }}
      />

      <div className="relative w-full max-w-sm">
        <div className="overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-xl">
          <div className="px-7 pb-6 pt-8 text-center sm:px-9">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-sm font-bold text-white ring-1 ring-white/25">
              SM
            </div>
            <h1 className="text-lg font-semibold text-white">Creer mon compte</h1>
            <p className="mt-1 text-xs text-white/60">Espace citoyen — Ville de N&apos;Djamena</p>
          </div>
          <div className="mx-7 h-px bg-white/15 sm:mx-9" />
          <div className="px-7 py-7 sm:px-9">
            <RegisterForm />
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-white/60">
          Deja un compte ?{" "}
          <Link href="/portail/login" className="font-medium text-white hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
