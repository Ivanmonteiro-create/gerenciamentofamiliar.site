import "./globals.css";
import ThemeToggle from "./components/ThemeToggle";

export const metadata = {
  title: "Gerenciamento Financeiro",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body>
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh" }}>
          {/* Sidebar existente */}
          <aside style={{ background: "#0b1220", color: "#e7edf7", padding: "18px 14px" }}>
            <nav className="menu">
              <div className="logo" style={{ fontWeight: 700, fontSize: 18, marginBottom: 14 }}>GF</div>
              <a href="/dashboard">📊 Dashboard</a>
              <a href="/despesas">💸 Despesas & Receitas</a>
              <a href="/cartoes">💳 Cartões</a>
              <a href="/dividas">📉 Dívidas</a>
              <a href="/emprestimos">💼 Empréstimos</a>
              <a href="/investimentos">📈 Investimentos</a>
              <a href="/configuracoes">⚙️ Configurações</a>
            </nav>
          </aside>

          {/* Conteúdo */}
          <main style={{ padding: "22px 22px 32px", position: "relative" }}>
            {/* FAB de tema global (sol/lua) */}
            <ThemeToggle />
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
