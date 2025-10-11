import categorias from "../data/categorias.json";

const titulos = {
  entradas: "Entradas",
  saidas_fixas: "Saídas (fixas)",
  saidas_variaveis: "Saídas (variáveis)",
  cartoes_credito: "Cartões de Crédito",
  dividas_emprestimos: "Dívidas & Empréstimos",
  investimentos: "Investimentos",
  contas_patrimonio: "Contas & Patrimônio",
};

export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, Arial, sans-serif" }}>
      <h1 style={{ marginBottom: 8 }}>Site no ar ✅</h1>
      <p style={{ marginTop: 0 }}>
        Deploy mínimo do Next.js via GitHub. Abaixo, pré-visualização das categorias.
      </p>

      <h2 style={{ marginTop: 24 }}>Categorias</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12,
          marginTop: 12,
        }}
      >
        {Object.entries(categorias).map(([chave, lista]) => (
          <div
            key={chave}
            style={{
              border: "1px solid #eee",
              borderRadius: 8,
              padding: 12,
              background: "#fff",
            }}
          >
            <h3 style={{ marginTop: 0 }}>{titulos[chave] || chave}</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {lista.map((nome) => (
                <li key={nome}>{nome}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
