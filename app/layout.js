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

        <style jsx global>{`
          * { box-sizing: border-box; }
          body { margin: 0; font-family: system-ui, Arial, sans-serif; color: #111; background:#f6f7fb; }
          .shell { display: grid; grid-template-columns: 260px 1fr; min-height: 100vh; }
          .sidebar { background: #0f172a; color:#fff; padding: 20px; }
          .logo { margin:0 0 16px; font-size: 20px; letter-spacing: 1px; }
          .menu { display: flex; flex-direction: column; gap: 10px; }
          .menu a { color:#cbd5e1; text-decoration:none; padding:10px 12px; border-radius:8px; }
          .menu a:hover { background:#1e293b; color:#fff; }
          .content { padding: 24px; }
          .grid { display:grid; gap:14px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
          .card { background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:16px; }
          .card h3 { margin:0 0 6px; font-size:16px; }
          .muted { color:#6b7280; font-size:13px; margin:0; }
          .btn-link { display:inline-block; margin-top:8px; text-decoration:none; color:#0ea5e9; }
          @media (max-width: 860px) {
            .shell { grid-template-columns: 1fr; }
            .sidebar { display:flex; gap:10px; align-items:center; overflow-x:auto; }
            .menu { flex-direction:row; gap:6px; }
            .menu a { white-space:nowrap; }
          }
        `}</style>
      </body>
    </html>
  );
}
