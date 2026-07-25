import { TelegramLogo } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your Veyra dashboard"
};

const loginButton = "flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors motion-reduce:transition-none";

const loginErrors: Record<string, string> = {
  access_denied: "This Telegram account does not have access to Veyra.",
  telegram_login: "Telegram login couldn’t be completed. Please try again."
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const requestedError = (await searchParams).error;
  const error = typeof requestedError === "string"
    ? loginErrors[requestedError]
    : null;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-white p-4 text-veyra-ink sm:p-6">
      <Image
        src="/assets/veyra-logo.png"
        width={840}
        height={194}
        sizes="132px"
        alt="Veyra"
        className="relative z-20 h-auto w-[132px]"
        preload
      />

      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full text-veyra-cyan opacity-25"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
      >
        <path d="M0 175H170L210 215H520L590 285H1440" fill="none" stroke="currentColor" />
        <path d="M0 770H130L190 710H510L570 650" fill="none" stroke="currentColor" />
        <path d="M1080 0V105L1015 170V340" fill="none" stroke="currentColor" />
      </svg>

      <div className="relative mx-auto grid min-h-[calc(100dvh-80px)] max-w-6xl items-center lg:grid-cols-[minmax(320px,420px)_1fr]">
        <section
          aria-labelledby="login-title"
          className="relative z-10 rounded-veyra border border-veyra-line bg-white/95 p-6 shadow-[0_18px_50px_rgba(18,23,34,0.08)] sm:p-8"
        >
          <h1 id="login-title" className="text-2xl font-bold tracking-[-0.03em]">
            Welcome to Veyra
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Secure. Intelligent. Always in control.
          </p>

          {error ? (
            <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="mt-8">
            <a
              href="/auth/telegram"
              className={`${loginButton} bg-sky-600 text-white hover:bg-sky-700`}
            >
              <TelegramLogo size={18} weight="fill" aria-hidden="true" />
              Login with Telegram
            </a>
          </div>
        </section>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-8 -right-40 left-28 opacity-15 sm:left-52 lg:relative lg:inset-auto lg:h-[min(76dvh,760px)] lg:opacity-70"
        >
          <Image
            src="/assets/veyra-login-line-art.webp"
            alt=""
            fill
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-contain object-right-bottom"
            preload
          />
        </div>
      </div>
    </main>
  );
}
