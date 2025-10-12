import "./globals.css";
import ThemeToggle from "./components/ThemeToggle";
export const metadata = { title: "Gerenciamento Financeiro" };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <h1 className="logo">GF</h1>
            <nav className="menu">
              <a href="/dashboard">🏠 Dashboard</a>
              <a href="/despesas">💸 Despesas & Receitas</a>
              <a href="/cartoes">💳 Cartões</a>
              <a href="/dividas">📉 Dívidas</a>
              <a href="/emprestimos">🏦 Empréstimos</a>
              <a href="/investimentos">📈 Investimentos</a>
              <a href="/configuracoes">⚙️ Configurações</a>
            </nav>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    <ThemeToggle />
    </html>
  );
}
