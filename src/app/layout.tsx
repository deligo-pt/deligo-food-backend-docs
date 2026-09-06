import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { SearchProvider } from "@/components/search/SearchProvider";
import { SITE } from "@/lib/config";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — Backend Documentation`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  robots: { index: false, follow: false },
  applicationName: SITE.name,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <a
          href="#main-content"
          className="sr-only rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm font-medium text-fg shadow-pop focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200]"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <SearchProvider>{children}</SearchProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
