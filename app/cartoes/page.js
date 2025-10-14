"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Modelo de dados salvo em localStorage (chave: gf-cartoes)
 * [
 *   {
 *     id: "c1",
 *     nome: "Millennium",
 *     cor: "#2563eb",
 *     limite: 6000,
 *     fechamento: 1,   // dia
 *     vencimento: 5,   // dia
 *     lancamentos: [
 *       {
 *         id: "l1",
 *         data: "2025-10-14",
 *         descricao: "Mercado",
 *         parcelas: 2,              // total de parcelas
 *         parcelaAtual: 1,          // opcional: quantas já foram quitadas
 *         valor: 400,
 *         status: "Pago" | "Pendente"
 *       }
 *     ]
 *   }
 * ]
 */

// ------- Utils -------
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
  // "2025-10-14" -> "14/10/25"
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${String(
    y
  ).slice(-2)}`;
}

// mostra parcelas como "2-1" (total-restantes) ou "—" se for parcela única
function formatParcelas(l) {
  const total = Number(l?.parcelas || 1);

  // Se controlar explicitamente, usa parcelaAtual:
  const atual = Number(l?.parcelaAtual || 0);

  // fallback inteligente: se marcou "Pago" e total>1, assume ao menos 1 pago
  const deduzida = l?.status === "Pago" && total > 1 ? 1 : 0;

  const pagas = Math.max(atual, deduzida);
  const restantes = Math.max(0, total - pagas);

  return total > 1 ? `${total}-${restantes}` : "—";
}

// ------- Página -------
export default function CartoesPage() {
  const [dados, setDados] = useState([]);
  const [cardIdAtivo, setCardIdAtivo] = useState("");
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
    status: "Pendente",
  });

  // Carrega / salva no localStorage
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

  // Cálculos de resumo do cartão ativo
  const resumo = useMemo(() => {
    if (!cardAtivo) {
      return { usado: 0, pendente: 0, disponivel: 0 };
    }
    const usado = cardAtivo.lancamentos
      .filter((l) => l.status === "Pago")
      .reduce((a, b) => a + Number(b.valor || 0), 0);
    const pendente = cardAtivo.lancamentos
      .filter((l) => l.status !== "Pago")
      .reduce((a, b) => a + Number(b.valor || 0), 0);
    const disponivel = Number(cardAtivo.limite || 0) - (usado + pendente);
    return { usado, pendente, disponivel };
  }, [cardAtivo]);

  // Ações – Cartão
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

  // Ações – Lançamentos
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
      status: novoLanc.status,
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
      status: "Pendente",
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

  // --------- UI ----------
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

            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginLeft: "auto",
              }}
            >
              {cardAtivo && (
                <>
                  <span style={{ fontSize: 13, opacity: 0.7 }}>
                    Fechamento: {String(cardAtivo.fechamento).padStart(2, "0")}
                  </span>
                  <span style={{ fontSize: 13, opacity: 0.7 }}>
                    Vencimento: {String(cardAtivo.vencimento).padStart(2, "0")}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Resumo do cartão ativo */}
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

          {/* Tabela de fatura / lançamentos */}
          <div className="painel">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 600 }}>Fatura</div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                mês atual de {new Date().toLocaleString("pt-PT", { month: "long", year: "numeric" })}
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
                  {!cardAtivo || cardAtivo.lancamentos.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 18, opacity: 0.7 }}>
                        Nenhum lançamento nesta fatura.
                      </td>
                    </tr>
                  ) : (
                    cardAtivo.lancamentos.map((l) => (
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

          {/* Novo lançamento no cartão */}
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
              <label>
                Status
                <select
                  value={novoLanc.status}
                  onChange={(e) =>
                    setNovoLanc({ ...novoLanc, status: e.target.value })
                  }
                >
                  <option value="Pendente">Pendente</option>
                  <option value="Pago">Pago</option>
                </select>
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

/* ---------------- estilos locais (escopados por classe) --------------- */
/* Se preferir, pode mover para um CSS global. Mantive aqui junto para ficar
   fechamento 100% do patch. */
