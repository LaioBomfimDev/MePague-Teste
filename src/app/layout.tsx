import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";

const geist = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist",
});

export const metadata: Metadata = {
  title: "Me Pague",
  description: "Controle simples de dívidas informais",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Me Pague",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                try {
                  const key = "me-pague:theme";
                  const allowed = ["system", "light", "dark", "pink", "pink-full", "pink-night", "blue", "blue-full", "blue-night", "lime-pop", "aurora-mint", "graphite-coral"];
                  const stored = localStorage.getItem(key);
                  const choice = allowed.includes(stored) ? stored : "system";
                  const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
                  const theme = choice === "system" ? (systemDark ? "dark" : "light") : choice;
                  const meta = {
                    "aurora-mint": ["light", "#F5FDFF"],
                    blue: ["light", "#F4F9FF"],
                    "blue-full": ["light", "#DBEAFE"],
                    "blue-night": ["dark", "#06152E"],
                    dark: ["dark", "#101011"],
                    "graphite-coral": ["dark", "#111716"],
                    "lime-pop": ["light", "#F7FFE9"],
                    light: ["light", "#FFFFFF"],
                    pink: ["light", "#FFF6FB"],
                    "pink-full": ["light", "#FFD6E9"],
                    "pink-night": ["dark", "#240012"]
                  }[theme];
                  document.documentElement.dataset.theme = theme;
                  document.documentElement.dataset.themeChoice = choice;
                  document.documentElement.style.colorScheme = meta[0];
                } catch {}
              })();
            `,
          }}
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icons/favicon-32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className={`${geist.className} min-h-screen selection:bg-ios-blue selection:text-white`}>
        <ThemeProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
