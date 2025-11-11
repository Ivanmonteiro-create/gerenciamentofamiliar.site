// app/layout.js
import "./globals.css";

export const metadata = {
  title: "Gerenciamento Financeiro",
  manifest: "/manifest.webmanifest",
  themeColor: "#0f172a",
  icons: {
    icon: "/icon-192.png",      // favicon / ícone padrão
    apple: "/icon-192.png"      // ícone para iOS (Add to Home Screen)
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt">
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

          <main className="content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
