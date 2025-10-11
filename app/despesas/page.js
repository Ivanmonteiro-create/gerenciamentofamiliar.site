import categorias from "../../data/categorias.json";

export default function DespesasReceitas() {
  const todasCategorias = [
    ...categorias.entradas,
    ...categorias.saidas_fixas,
    ...categorias.saidas_variaveis,
  ];
  return (
    <>
      <h2 style={{marginTop:0}}>Despesas & Receitas</h2>
      <div className="card">
        <p className="muted">
          Aqui vai o formulário de lançamento e a tabela. (Sprint 1 – próximo passo)
        </p>
        <p style={{marginTop:10}}><b>Exemplo de categorias:</b></p>
        <ul style={{columns:2, marginTop:8}}>
          {todasCategorias.map(c => <li key={c}>{c}</li>)}
        </ul>
      </div>
    </>
  );
}
