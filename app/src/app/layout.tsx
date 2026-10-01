import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider, Show, SignInButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { EmailAlertsPanel } from "@/components/EmailAlertsPanel";
import { NavLinks } from "@/components/NavLinks";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Card Index", template: "%s · Card Index" },
  description: "Instant Pokémon card values: fair price, max buy price, and grade comparison.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { userId } = await auth();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ClerkProvider afterSignOutUrl="/">
          <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
            <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
              <Link href="/" className="flex items-center gap-2 text-base font-bold tracking-tight">
                <span aria-hidden className="inline-block h-5 w-5 rotate-45 rounded-[4px] bg-accent" />
                Card Index
              </Link>
              <div className="min-w-0 flex-1">
                <NavLinks signedIn={Boolean(userId)} />
              </div>
              <Show
                when="signed-in"
                fallback={
                  <SignInButton mode="modal">
                    <button className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink">Sign in</button>
                  </SignInButton>
                }
              >
                <UserButton>
                  <UserButton.UserProfilePage
                    label="Email alerts"
                    url="email-alerts"
                    labelIcon={
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="m3 7 9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    }
                  >
                    <EmailAlertsPanel />
                  </UserButton.UserProfilePage>
                </UserButton>
              </Show>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
          <footer className="border-t border-line py-6 text-center text-xs text-ink-3">
            Prices are aggregated from public eBay and TCGplayer sales data. Not financial advice.
          </footer>
        </ClerkProvider>
      </body>
    </html>
  );
}
