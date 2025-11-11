// app/layout.js
import "./globals.css";

export const metadata = {
  title: "Gerenciamento Financeiro",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt">
      <head>
        {/* Manifest + ícones */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icons/icon-192.png" sizes="192x192" />
        <link rel="icon" href="/icons/icon-512.png" sizes="512x512" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="application-name" content="Gerenciamento Financeiro" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>

      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="logo">GF</div>
            <nav className="menu">
              <a href="/dashboard">📊 Dashboard</a>
              <a href="/despesas">💸 Despesas & Receitas</a>
              <a href="/cartoes">💳 Cartões</a>
              <a href="/emprestimos">📑 Empréstimos</a>
              <a href="/investimentos">📈 Investimentos</a>
              <a href="/configuracoes">⚙️ Configurações</a>
            </nav>
          </aside>

          <main className="content">{children}</main>
        </div>

        {/* Registra o Service Worker (pede HTTPS e produção) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
