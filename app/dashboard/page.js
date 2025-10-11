import categorias from "../../data/categorias.json";

const cards = [
  { href: "/despesas",   title: "Entradas & Saídas", desc: "Lançar e visualizar movimentos do mês" },
  { href: "/cartoes",    title: "Cartões",           desc: "Faturas, parcelas e vencimentos" },
  { href: "/dividas",    title: "Dívidas",           desc: "Controle de quitação e progresso" },
  { href: "/emprestimos",title: "Empréstimos",       desc: "Parcelas (X de Y) e saldo devedor" },
  { href: "/investimentos", title: "Investimentos",  desc: "Portfólio e patrimônio" },
  { href: "/configuracoes", title: "Configurações",  desc: "Preferências e categorias" },
];

export default function Dashboard() {
  const totalCategorias =
    Object.values(categorias).reduce((acc, lista) => acc + lista.length, 0);

  return (
    <>
      <h2 style={{marginTop:0}}>Dashboard</h2>
      <div className="grid">
        {cards.map(c => (
          <div key={c.href} className="card">
            <h3>{c.title}</h3>
            <p className="muted">{c.desc}</p>
            <a className="btn-link" href={c.href}>Abrir →</a>
          </div>
        ))}
        <div className="card">
          <h3>Resumo rápido</h3>
          <p className="muted">Categorias cadastradas: <b>{totalCategorias}</b></p>
          <a className="btn-link" href="/despesas">Lançar transações →</a>
        </div>
      </div>
    </>
  );
}
