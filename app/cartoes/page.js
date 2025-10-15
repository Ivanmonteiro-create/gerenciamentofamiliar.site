"use client";

import { useEffect, useMemo, useState } from "react";

// ---------------- Utils ----------------
const LS_KEY = "gf-cartoes";
const currency = (n = 0) =>
  (isFinite(n) ? n : 0).toLocaleString("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
function ymdToDisplay(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${String(
    y
  ).slice(-2)}`;
}
function addMonths(ymd, k) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m - 1) + k, d || 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
// mostra “total-restantes”
function formatParcelas(l) {
  const total = Number(l?.parcelas || 1);
  const atual = Number(l?.parcelaAtual || 0);
  const deduzida = l?.status === "Pago" && total > 1 ? 1 : 0;
  const pagas = Math.max(atual, deduzida);
  const restantes = Math.max(0, total - pagas);
  return total > 1 ? `${total}-${restantes}` : "—";
}
// há parcela deste lançamento no mês/ano selecionado?
function hasInstallmentInMonth(l, year, month) {
  const base = new Date(l.data);
  for (let k = 0; k < Math.max(1, Number(l.parcelas || 1)); k++) {
    const d = new Date(base.getFullYear(), base.getMonth() + k, base.getDate());
    if (d.getFullYear() === year && d.getMonth() + 1 === month) return true;
  }
  return false;
}

// ---------------- Página ----------------
export default function CartoesPage() {
  const [dados, setDados] = useState([]);
  const [cardIdAtivo, setCardIdAtivo] = useState("");

  // mês selecionado (navegação)
  const now = new Date();
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);

  const [novoCard, setNovoCard] = useState({
    nome: "",
    cor: "#2563eb",
    limite: 0,
    fechamento: 1,
    vencimento: 5,
  });
  const [novoLanc, setNovoLanc] = useState({
    data: new Date().toISOString().slice(0, 10),
    descricao: "",
    parcelas: 1,
    valor: "",
    // status removido do formulário; sempre começa como “Pendente”
  });

  // Carregar/Salvar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        setDados(Array.isArray(arr) ? arr : []);
        if (Array.isArray(arr) && arr[0]) setCardIdAtivo(arr[0].id);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(dados));
    } catch {}
  }, [dados]);

  const cardAtivo = useMemo(
    () => dados.find((c) => c.id === cardIdAtivo) || null,
    [dados, cardIdAtivo]
  );

  // Resumo do cartão (geral)
  const resumo = useMemo(() => {
    if (!cardAtivo) return { usado: 0, pendente: 0, disponivel: 0 };
    const usado = cardAtivo.lancamentos
      .filter((l) => l.status === "Pago")
      .reduce((a, b) => a + Number(b.valor || 0), 0);
    const pendente = cardAtivo.lancamentos
      .filter((l) => l.status !== "Pago")
      .reduce((a, b) => a + Number(b.valor || 0), 0);
    const disponivel = Number(cardAtivo.limite || 0) - (usado + pendente);
    return { usado, pendente, disponivel };
  }, [cardAtivo]);

  // Lançamentos visíveis no MÊS selecionado
  const lancamentosDoMes = useMemo(() => {
    if (!cardAtivo) return [];
    return cardAtivo.lancamentos.filter((l) =>
      hasInstallmentInMonth(l, selYear, selMonth)
    );
  }, [cardAtivo, selYear, selMonth]);

  // Ações — Cartão
  function salvarNovoCartao(e) {
    e.preventDefault();
    if (!novoCard.nome.trim()) return;
    const c = {
      id: uid("card"),
      nome: novoCard.nome.trim(),
      cor: novoCard.cor || "#2563eb",
      limite: Number(novoCard.limite || 0),
      fechamento: Number(novoCard.fechamento || 1),
      vencimento: Number(novoCard.vencimento || 5),
      lancamentos: [],
    };
    const arr = [...dados, c];
    setDados(arr);
    setCardIdAtivo(c.id);
    setNovoCard({ nome: "", cor: "#2563eb", limite: 0, fechamento: 1, vencimento: 5 });
  }
  function excluirCartao(id) {
    if (!confirm("Excluir este cartão?")) return;
    const arr = dados.filter((c) => c.id !== id);
    setDados(arr);
    if (arr[0]) setCardIdAtivo(arr[0].id);
    else setCardIdAtivo("");
  }

  // Ações — Lançamentos
  function adicionarLancamento(e) {
    e.preventDefault();
    if (!cardAtivo) return;
    const l = {
      id: uid("l"),
      data: novoLanc.data,
      descricao: novoLanc.descricao.trim(),
      parcelas: Math.max(1, Number(novoLanc.parcelas || 1)),
      parcelaAtual: 0,
      valor: Number(novoLanc.valor || 0),
      status: "Pendente",
    };
    const arr = dados.map((c) =>
      c.id === cardAtivo.id
        ? { ...c, lancamentos: [l, ...c.lancamentos] }
        : c
    );
    setDados(arr);
    setNovoLanc({
      data: new Date().toISOString().slice(0, 10),
      descricao: "",
      parcelas: 1,
      valor: "",
    });
  }
  function marcarPago(idLanc, pago = true) {
    if (!cardAtivo) return;
    const arr = dados.map((c) => {
      if (c.id !== cardAtivo.id) return c;
      const lancamentos = c.lancamentos.map((l) =>
        l.id === idLanc
          ? {
              ...l,
              status: pago ? "Pago" : "Pendente",
              parcelaAtual:
                pago && l.parcelas > 1
                  ? Math.min((l.parcelaAtual || 0) + 1, l.parcelas)
                  : l.parcelaAtual || 0,
            }
          : l
      );
      return { ...c, lancamentos };
    });
    setDados(arr);
  }
  function excluirLancamento(idLanc) {
    if (!cardAtivo) return;
    if (!confirm("Excluir lançamento?")) return;
    const arr = dados.map((c) =>
      c.id === cardAtivo.id
        ? { ...c, lancamentos: c.lancamentos.filter((l) => l.id !== idLanc) }
        : c
    );
    setDados(arr);
  }

  // Navegação de mês
  const nomeMes = new Date(selYear, selMonth - 1, 1).toLocaleString("pt-PT", {
    month: "long",
    year: "numeric",
  });
  function prevMonth() {
    let m = selMonth - 1;
    let y = selYear;
    if (m < 1) { m = 12; y -= 1; }
    setSelMonth(m); setSelYear(y);
  }
  function nextMonth() {
    let m = selMonth + 1;
    let y = selYear;
    if (m > 12) { m = 1; y += 1; }
    setSelMonth(m); setSelYear(y);
  }

  // -------- UI --------
  return (
    <div style={{ overflowX: "auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>
        Cartões de Crédito
      </h1>

      <div className="cartoes-grid">
        {/* ESQUERDA */}
        <section className="cartoes-col-esq">
          {/* Cabeçalho / seleção do cartão */}
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <label>
              Cartão:&nbsp;
              <select
                value={cardIdAtivo}
                onChange={(e) => setCardIdAtivo(e.target.value)}
              >
                {dados.length === 0 && <option value="">—</option>}
                {dados.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} (limite {currency(c.limite)})
                  </option>
                ))}
              </select>
            </label>

            {cardAtivo && (
              <div style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
                <span style={{ fontSize: 13, opacity: 0.7 }}>
                  Fechamento: {String(cardAtivo.fechamento).padStart(2, "0")}
                </span>
                <span style={{ fontSize: 13, opacity: 0.7 }}>
                  Vencimento: {String(cardAtivo.vencimento).padStart(2, "0")}
                </span>
              </div>
            )}
          </div>

          {/* Resumo */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(120px, 1fr))",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div className="card-resumo">
              <div className="label">Limite</div>
              <div className="valor">{currency(cardAtivo?.limite || 0)}</div>
            </div>
            <div className="card-resumo">
              <div className="label">Usado</div>
              <div className="valor">{currency(resumo.usado)}</div>
            </div>
            <div className="card-resumo">
              <div className="label">Pendente</div>
              <div className="valor">{currency(resumo.pendente)}</div>
            </div>
            <div className="card-resumo">
              <div className="label">Disponível</div>
              <div className="valor">{currency(resumo.disponivel)}</div>
            </div>
          </div>

          {/* Fatura do mês selecionado */}
          <div className="painel">
            {/* Barra de mês */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button className="btn-sec" onClick={prevMonth}>◀</button>
                <strong>{nomeMes}</strong>
                <button className="btn-sec" onClick={nextMonth}>▶</button>
              </div>

              <div style={{ fontSize: 13, opacity: 0.7 }}>
                Mostrando parcelas previstas para este mês
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="tabela">
                <thead>
                  <tr>
                    <th style={{ width: 96 }}>Data</th>
                    <th style={{ minWidth: 220, textAlign: "left" }}>Descrição</th>
                    <th style={{ width: 96 }}>Parcelas</th>
                    <th style={{ width: 110 }}>Valor</th>
                    <th style={{ width: 110 }}>Status</th>
                    <th style={{ width: 200 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {!cardAtivo || lancamentosDoMes.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 18, opacity: 0.7 }}>
                        Nenhum lançamento neste mês.
                      </td>
                    </tr>
                  ) : (
                    lancamentosDoMes.map((l) => (
                      <tr key={l.id}>
                        <td>{ymdToDisplay(l.data)}</td>
                        <td className="td-descricao">{l.descricao}</td>
                        <td>{formatParcelas(l)}</td>
                        <td>{currency(l.valor)}</td>
                        <td>
                          <span
                            className={`pill ${
                              l.status === "Pago" ? "pill-ok" : "pill-warn"
                            }`}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td>
                          <div className="acoes">
                            {l.status === "Pago" ? (
                              <button
                                className="btn-sec"
                                onClick={() => marcarPago(l.id, false)}
                              >
                                Marcar pendente
                              </button>
                            ) : (
                              <button
                                className="btn-sec"
                                onClick={() => marcarPago(l.id, true)}
                              >
                                Marcar pago
                              </button>
                            )}
                            <button
                              className="btn-danger"
                              onClick={() => excluirLancamento(l.id)}
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* DIREITA */}
        <aside className="cartoes-col-dir">
          {/* Novo cartão */}
          <div className="painel">
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Novo cartão</div>

            <form onSubmit={salvarNovoCartao} className="form-grid">
              <label>
                Nome do cartão
                <input
                  type="text"
                  value={novoCard.nome}
                  onChange={(e) =>
                    setNovoCard({ ...novoCard, nome: e.target.value })
                  }
                  placeholder="Ex.: Visa XP"
                  required
                />
              </label>
              <label>
                Limite
                <input
                  type="number"
                  value={novoCard.limite}
                  onChange={(e) =>
                    setNovoCard({
                      ...novoCard,
                      limite: Number(e.target.value || 0),
                    })
                  }
                  min={0}
                />
              </label>
              <label>
                Fechamento
                <input
                  type="number"
                  value={novoCard.fechamento}
                  min={1}
                  max={28}
                  onChange={(e) =>
                    setNovoCard({
                      ...novoCard,
                      fechamento: Number(e.target.value || 1),
                    })
                  }
                />
              </label>
              <label>
                Vencimento
                <input
                  type="number"
                  value={novoCard.vencimento}
                  min={1}
                  max={28}
                  onChange={(e) =>
                    setNovoCard({
                      ...novoCard,
                      vencimento: Number(e.target.value || 5),
                    })
                  }
                />
              </label>
              <label>
                Cor
                <input
                  type="color"
                  value={novoCard.cor}
                  onChange={(e) =>
                    setNovoCard({ ...novoCard, cor: e.target.value })
                  }
                />
              </label>

              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" className="btn-primary">
                  Salvar cartão
                </button>
                {cardAtivo && (
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => excluirCartao(cardAtivo.id)}
                  >
                    Excluir cartão
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Novo lançamento no cartão (Status REMOVIDO) */}
          <div className="painel">
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              Novo lançamento no cartão
            </div>

            <form onSubmit={adicionarLancamento} className="form-grid">
              <label>
                Data
                <input
                  type="date"
                  value={novoLanc.data}
                  onChange={(e) =>
                    setNovoLanc({ ...novoLanc, data: e.target.value })
                  }
                />
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                Descrição
                <input
                  type="text"
                  value={novoLanc.descricao}
                  onChange={(e) =>
                    setNovoLanc({ ...novoLanc, descricao: e.target.value })
                  }
                  placeholder="Ex.: Supermercado"
                  required
                />
              </label>
              <label>
                Parcelas
                <input
                  type="number"
                  min={1}
                  value={novoLanc.parcelas}
                  onChange={(e) =>
                    setNovoLanc({
                      ...novoLanc,
                      parcelas: Math.max(1, Number(e.target.value || 1)),
                    })
                  }
                />
              </label>
              <label>
                Valor
                <input
                  type="number"
                  step="0.01"
                  value={novoLanc.valor}
                  onChange={(e) =>
                    setNovoLanc({ ...novoLanc, valor: e.target.value })
                  }
                />
              </label>

              <button type="submit" className="btn-primary">
                Adicionar
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
