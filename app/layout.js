// app/layout.js
import "./globals.css";

export const metadata = {
  title: "Gerenciamento Financeiro",
  description: "Controle de despesas, cartões, empréstimos e investimentos.",
  manifest: "/manifest.webmanifest",
  themeColor: "#0f172a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-PT">
      <head>
        {/* PWA */}
        <meta name="theme-color" content="#0f172a" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>{children}</body>
    </html>
  );
}
