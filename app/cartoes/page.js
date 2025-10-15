"use client";

import { useEffect, useMemo, useState } from "react";

/** ====== STORAGE KEYS ====== */
const CARDS_KEY = "gf_cards_v1";
const CARD_CHARGES_KEY = "gf_card_charges_v1"; // lançamentos por fatura (parcelas já “espalhadas”)
const TX_STORAGE_KEY = "gf_transactions_v1";   // integra com Despesas & Receitas

/** ====== HELPERS DE STORAGE ====== */
function loadLS(key, fallback) {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(6);
}

/** ====== DATE HELPERS ====== */
function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function addMonthsYM(ym, add) {
  // ym: "YYYY-MM"; add: número de meses
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(y, m - 1 + add, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function ymLabel(ym) {
  const d = new Date(ym + "-01T00:00:00");
  return d.toLocaleString("pt-PT", { month: "long", year: "numeric" });
}
function formatCurrency(n) {
  const v = Number(n || 0);
  return v.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

/** ====== CSV ====== (sem categoria) */
function toCSV(rows) {
  const header = ["Data", "Descrição", "Parcela", "Valor", "Status"];
  const lines = rows.map(r => [
    r.date || "",
    (r.desc || "").replaceAll(";", ","),
    r.installments > 1 ? `${r.installments}-${Math.max(0, r.installments - r.parcelIndex)}` : "",
    String(r.value).replace(".", ","),
    r.status === "pago" ? "Pago" : "Pendente",
  ]);
  const all = [header, ...lines].map(arr => arr.join(";")).join("\n");
  return all;
}

/** ====== COMPONENTE ====== */
export default function CartoesPage() {
  /** dados base */
  const [cards, setCards] = useState([]);
  const [charges, setCharges] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [faturaYm, setFaturaYm] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
  });

  /** forms */
  const [cardForm, setCardForm] = useState({
    name: "",
    limit: "",
    closingDay: 1,
    dueDay: 5,
    color: "#4f46e5",
  });

  const [chargeForm, setChargeForm] = useState({
    date: todayISO(),
    desc: "",
    value: "",
    installments: 1, // parcelas
    firstYm: "",     // primeira fatura (YYYY-MM)
  });

  /** carregar LS */
  useEffect(() => {
    setCards(loadLS(CARDS_KEY, []));
    setCharges(loadLS(CARD_CHARGES_KEY, []));
  }, []);

  /** quando muda a data do lançamento, sugere a 1ª fatura como o mês da data */
  useEffect(() => {
    if (!chargeForm.firstYm) {
      const d = new Date(chargeForm.date || todayISO());
      setChargeForm(p => ({
        ...p,
        firstYm: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      }));
    }
  }, [chargeForm.date]); // eslint-disable-line

  /** card selecionado (obj) */
  const selectedCard = useMemo(
    () => cards.find(c => c.id === selectedCardId) || null,
    [cards, selectedCardId]
  );

  /** fatura do mês atual (para o card selecionado) */
  const currentInvoiceItems = useMemo(() => {
    if (!selectedCard) return [];
    return charges
      .filter(c => c.cardId === selectedCard.id && c.faturaYm === faturaYm)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }, [charges, selectedCard, faturaYm]);

  const invoiceTotal = useMemo(
    () => currentInvoiceItems.reduce((s, it) => s + Number(it.value || 0), 0),
    [currentInvoiceItems]
  );

  /** uso do limite (considera parcelas PENDENTES de qualquer mês FUTURO+ATUAL) */
  const limitUsed = useMemo(() => {
    if (!selectedCard) return 0;
    const nowYm = faturaYm;
    return charges
      .filter(c => c.cardId === selectedCard.id && c.status !== "pago" && c.faturaYm >= nowYm)
      .reduce((s, it) => s + Number(it.value || 0), 0);
  }, [charges, selectedCard, faturaYm]);

  /** ====== ações: cartões ====== */
  function addCard(e) {
    e.preventDefault();
    const newCard = {
      id: uid(),
      name: cardForm.name.trim() || "Cartão",
      limit: Number(cardForm.limit || 0),
      closingDay: Number(cardForm.closingDay || 1),
      dueDay: Number(cardForm.dueDay || 5),
      color: cardForm.color || "#4f46e5",
      createdAt: Date.now(),
  };
    const next = [...cards, newCard];
    setCards(next);
    saveLS(CARDS_KEY, next);
    setSelectedCardId(newCard.id);
    setCardForm({ name: "", limit: "", closingDay: 1, dueDay: 5, color: "#4f46e5" });
  }

  function deleteCard(id) {
    if (!confirm("Excluir este cartão e todos os lançamentos relacionados?")) return;
    const nextCards = cards.filter(c => c.id !== id);
    const nextCharges = charges.filter(c => c.cardId !== id);
    setCards(nextCards);
    setCharges(nextCharges);
    saveLS(CARDS_KEY, nextCards);
    saveLS(CARD_CHARGES_KEY, nextCharges);
    if (selectedCardId === id) setSelectedCardId("");
  }

  /** ====== ações: fatura/lançamentos ====== */
  function addCharge(e) {
    e.preventDefault();
    if (!selectedCard) {
      alert("Selecione um cartão primeiro.");
      return;
    }
    const value = Number(chargeForm.value || 0);
    const n = Math.max(1, Number(chargeForm.installments || 1));
    const parcelaValor = Math.round((value / n) * 100) / 100; // arredonda 2 casas
    const rows = [];
    for (let i = 0; i < n; i++) {
      const ym = addMonthsYM(chargeForm.firstYm, i);
      rows.push({
        id: uid(),
        cardId: selectedCard.id,
        faturaYm: ym, // YYYY-MM
        date: chargeForm.date, // data da compra
        desc: chargeForm.desc.trim(),
        value: parcelaValor,
        installments: n,
        parcelIndex: i + 1,
        status: "pendente",
        createdAt: Date.now(),
      });
    }
    const next = [...charges, ...rows];
    setCharges(next);
    saveLS(CARD_CHARGES_KEY, next);
    setChargeForm({
      date: todayISO(),
      desc: "",
      value: "",
      installments: 1,
      firstYm: "",
    });
  }

  function toggleChargeStatus(id) {
    const next = charges.map(c => (c.id === id ? { ...c, status: c.status === "pago" ? "pendente" : "pago" } : c));
    setCharges(next);
    saveLS(CARD_CHARGES_KEY, next);
  }

  function deleteCharge(id) {
    if (!confirm("Excluir este lançamento?")) return;
    const next = charges.filter(c => c.id !== id);
    setCharges(next);
    saveLS(CARD_CHARGES_KEY, next);
  }

  function exportCSV() {
    const csv = toCSV(currentInvoiceItems);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fatura_${selectedCard?.name || "cartao"}_${faturaYm}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** registra saída em Despesas para pagamento da fatura */
  function registrarPagamentoDespesas() {
    if (!selectedCard) return;
    if (invoiceTotal <= 0) {
      alert("Fatura sem valor.");
      return;
    }
    if (!confirm(`Registrar pagamento de ${formatCurrency(invoiceTotal)} em Despesas?`)) return;

    const txs = loadLS(TX_STORAGE_KEY, []);
    const dataISO = `${faturaYm}-05`; // usa dia 05 por padrão
    const tx = {
      id: uid(),
      data: dataISO,
      descricao: `Pagamento fatura – ${selectedCard.name} (${faturaYm})`,
      categoria: "Cartão de Crédito",
      tipo: "saida",
      valor: invoiceTotal,
      status: "pago",
      createdAt: new Date().toISOString(),
    };
    const next = [...txs, tx];
    saveLS(TX_STORAGE_KEY, next);
    alert("Pagamento registrado em Despesas & Receitas ✓");
  }

  const prevMonth = () => setFaturaYm(addMonthsYM(faturaYm, -1));
  const nextMonth = () => setFaturaYm(addMonthsYM(faturaYm, 1));

  /** ====== UI ====== */
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Cartões de Crédito</h1>

      {/* topo: seleção do cartão + info limite */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ ...cardBox, borderColor: selectedCard ? selectedCard.color : cardBox.borderColor }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ fontWeight: 600 }}>Cartão</label>
            <select
              value={selectedCardId}
              onChange={e => setSelectedCardId(e.target.value)}
              style={input}
              aria-label="Selecionar cartão"
            >
              <option value="">Selecione...</option>
              {cards.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} (limite {formatCurrency(c.limit)})
                </option>
              ))}
            </select>

            {/* bolinha de cor do cartão selecionado */}
            {selectedCard && (
              <span
                title={`Cor do cartão ${selectedCard.name}`}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  background: selectedCard.color,
                  display: "inline-block",
                  border: "1px solid #e5e7eb",
                }}
              />
            )}

            {selectedCard && (
              <button onClick={() => deleteCard(selectedCard.id)} style={btnDanger}>
                Excluir cartão
              </button>
            )}
          </div>

          {selectedCard && (
            <div style={{ display: "flex", gap: 24, marginTop: 12, flexWrap: "wrap" }}>
              <InfoPill label="Limite" value={formatCurrency(selectedCard.limit)} />
              <InfoPill label="Usado (pendente + atual)" value={formatCurrency(limitUsed)} />
              <InfoPill
                label="Disponível"
                value={formatCurrency(Math.max(0, selectedCard.limit - limitUsed))}
              />
              <InfoPill label="Fechamento" value={String(selectedCard.closingDay).padStart(2, "0")} />
              <InfoPill label="Vencimento" value={String(selectedCard.dueDay).padStart(2, "0")} />
            </div>
          )}
        </div>

        {/* cadastro de cartão */}
        <form onSubmit={addCard} className="card" style={cardBox}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Novo cartão</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              style={input}
              placeholder="Nome do cartão"
              value={cardForm.name}
              onChange={e => setCardForm(p => ({ ...p, name: e.target.value }))}
              required
            />
            <input
              style={input}
              placeholder="Limite"
              value={cardForm.limit}
              onChange={e => setCardForm(p => ({ ...p, limit: e.target.value }))}
              inputMode="decimal"
              required
            />
            <input
              style={input}
              placeholder="Fechamento (dia)"
              value={cardForm.closingDay}
              onChange={e => setCardForm(p => ({ ...p, closingDay: e.target.value }))}
              inputMode="numeric"
              required
            />
            <input
              style={input}
              placeholder="Vencimento (dia)"
              value={cardForm.dueDay}
              onChange={e => setCardForm(p => ({ ...p, dueDay: e.target.value }))}
              inputMode="numeric"
              required
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, opacity: 0.7 }}>Cor</span>
              <input
                type="color"
                value={cardForm.color}
                onChange={e => setCardForm(p => ({ ...p, color: e.target.value }))}
              />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <button type="submit" style={btnPrimary}>Salvar cartão</button>
          </div>
        </form>
      </div>

      {/* lançamentos + fatura */}
      {selectedCard ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16 }}>
            {/* fatura atual */}
            <div className="card" style={{ ...cardBox, borderColor: selectedCard.color }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontWeight: 700 }}>Fatura</div>

                {/* navegação por mês (◀ mês ▶) */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={prevMonth} style={btnSoft} aria-label="Mês anterior">◀</button>
                  <strong style={{ minWidth: 180, textAlign: "center", textTransform: "capitalize" }}>
                    {ymLabel(faturaYm)}
                  </strong>
                  <button onClick={nextMonth} style={btnSoft} aria-label="Próximo mês">▶</button>
                </div>

                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button onClick={exportCSV} style={btnSoft}>Exportar CSV</button>
                  <button onClick={registrarPagamentoDespesas} style={btnSuccess}>
                    Registrar pagamento na aba Despesas
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                {selectedCard.name} • {faturaYm} • Total: <b>{formatCurrency(invoiceTotal)}</b>
              </div>

              <div style={{ overflowX: "auto", marginTop: 10 }}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Descrição</th>
                      <th>Parcela</th>
                      <th>Valor</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentInvoiceItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: 16, textAlign: "center", opacity: 0.6 }}>
                          Nenhum lançamento nesta fatura.
                        </td>
                      </tr>
                    ) : currentInvoiceItems.map(it => (
                      <tr key={it.id}>
                        <td>{it.date}</td>
                        <td>{it.desc}</td>
                        <td>{it.installments > 1 ? `${it.installments}-${Math.max(0, it.installments - it.parcelIndex)}` : "—"}</td>
                        <td>{formatCurrency(it.value)}</td>
                        <td>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: it.status === "pago" ? "#dcfce7" : "#fee2e2",
                            color: it.status === "pago" ? "#166534" : "#991b1b",
                            fontSize: 12,
                          }}>
                            {it.status === "pago" ? "Pago" : "Pendente"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button style={btnSoft} onClick={() => toggleChargeStatus(it.id)}>
                              {it.status === "pago" ? "Marcar pendente" : "Marcar pago"}
                            </button>
                            <button style={btnDanger} onClick={() => deleteCharge(it.id)}>Excluir</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* novo lançamento no cartão (sem categoria) */}
            <form onSubmit={addCharge} className="card" style={cardBox}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Novo lançamento no cartão</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  type="date"
                  value={chargeForm.date}
                  onChange={e => setChargeForm(p => ({ ...p, date: e.target.value }))}
                  style={input}
                  required
                />
                <input
                  placeholder="Descrição"
                  value={chargeForm.desc}
                  onChange={e => setChargeForm(p => ({ ...p, desc: e.target.value }))}
                  style={input}
                  required
                />
                <input
                  placeholder="Valor"
                  value={chargeForm.value}
                  onChange={e => setChargeForm(p => ({ ...p, value: e.target.value }))}
                  inputMode="decimal"
                  style={input}
                  required
                />
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>Parcelas</span>
                  <input
                    type="number"
                    min={1}
                    value={chargeForm.installments}
                    onChange={e => setChargeForm(p => ({ ...p, installments: Number(e.target.value || 1) }))}
                    style={{ ...input, width: 100 }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>1ª fatura</span>
                  <input
                    type="month"
                    value={chargeForm.firstYm}
                    onChange={e => setChargeForm(p => ({ ...p, firstYm: e.target.value }))}
                    style={input}
                    required
                  />
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <button type="submit" style={btnPrimary}>Adicionar</button>
              </div>
            </form>
          </div>
        </>
      ) : (
        <div className="card" style={{ ...cardBox, marginTop: 16 }}>
          Selecione um cartão para visualizar a fatura e lançar compras.
        </div>
      )}
    </div>
  );
}

/** ====== UI “tokens” simples ====== */
const cardBox = {
  background: "var(--card-bg, #fff)",
  border: "1px solid var(--card-bd, #e5e7eb)",
  borderRadius: 14,
  padding: 14,
  boxShadow: "0 1px 2px rgba(0,0,0,.04)",
};

const input = {
  display: "inline-block",
  width: "100%",
  height: 36,
  padding: "0 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "var(--input-bg, #fff)",
  outline: "none",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};
const btnBase = {
  height: 34,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid transparent",
  cursor: "pointer",
};
const btnPrimary = {
  ...btnBase,
  background: "#2563eb",
  color: "#fff",
  borderColor: "#1d4ed8",
};
const btnSoft = {
  ...btnBase,
  background: "#f3f4f6",
  color: "#111827",
  borderColor: "#e5e7eb",
};
const btnSuccess = {
  ...btnBase,
  background: "#16a34a",
  color: "#fff",
  borderColor: "#15803d",
};
const btnDanger = {
  ...btnBase,
  background: "#fee2e2",
  color: "#991b1b",
  borderColor: "#fecaca",
};

function InfoPill({ label, value }) {
  return (
    <div style={{
      display: "grid",
      gap: 2,
      padding: "8px 10px",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      minWidth: 120,
      background: "#f9fafb",
    }}>
      <span style={{ fontSize: 12, opacity: 0.7 }}>{label}</span>
      <b style={{ fontSize: 15 }}>{value}</b>
    </div>
  );
}
