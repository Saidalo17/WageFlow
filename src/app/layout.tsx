import type { Metadata } from "next";
import { Manrope, Noto_Sans_Arabic, Noto_Sans_SC } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Providers } from "@/components/providers";
import { dirOf } from "@/lib/intl-locale";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

// Arabic letters; loaded only when the interface is in Arabic.
const notoArabic = Noto_Sans_Arabic({
  variable: "--font-noto-ar",
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  preload: false,
  display: "swap",
});

// Fallback for Chinese characters; loaded only when they are used.
const notoSc = Noto_Sans_SC({
  variable: "--font-noto-sc",
  weight: ["400", "500", "700"],
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Kapio", template: "%s · Kapio" },
  description: "Personal finance tracker",
  openGraph: { title: "Kapio", description: "Personal finance tracker", images: [{ url: "/hero.png", width: 397, height: 228 }] },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      suppressHydrationWarning
      className={`${manrope.variable} ${notoSc.variable} ${notoArabic.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
