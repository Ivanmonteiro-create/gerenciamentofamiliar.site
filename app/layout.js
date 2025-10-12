export const metadata = {
  title: "GF — Gerenciamento Financeiro",
  description: "App pessoal de finanças",
};

import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
