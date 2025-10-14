"use client";

import React, { useEffect, useMemo, useState } from "react";

/* ============================
   Chaves de armazenamento
============================ */
const STORAGE_CARDS = "gf_cards_v2";
const STORAGE_OPS = "gf_card_ops_v2";

/* ============================
   Utilitários
============================ */
const currency = (n = 0) =>
  (isFinite(n) ? n : 0).toLocaleString("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

const pad2 = (n) => String(n).padStart(2, "0");

const fmtDateDDMMYY = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(
    d.getFullYear()
  ).slice(-2)}`;
};

const monthLabelShort = (dateObj) => {
  const m = dateObj.toLocaleDateString("pt-PT", { month: "long" });
  const yy = String(dateObj.getFullYear()).slice(-2);
  return `${m} de ${yy}`;
};

const yyyymm = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

const newId = () => Math.random().toString(36).slice(2, 10);

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

/* ============================
   Página
============================ */
export default function CartoesPage() {
  const [cards, setCards] = useState([]);
  const [ops, setOps] = useState([]);

  const [selectedCard, setSelectedCard] = useState("");
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [onlyPaid, setOnlyPaid] = useState(false);

  // Form novo cartão
  const [cardName, setCardName] = useState("");
  const [cardLimit, setCardLimit] = useState("");
  const [cardColor, setCardColor] = useState("#2563eb");
  const [cardClose, setCardClose] = useState(1);      // dia de fechamento
  const [cardDue, setCardDue] = useState(5);          // dia de vencimento

  // Form nova compra
  const [opDate, setOpDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [opDesc, setOpDesc] = useState("");
  const [opParcels, setOpParcels] = useState(1);
  const [opAmount, setOpAmount] = useState("");

  // Carrega dados
  useEffect(() => {
    const c = load(STORAGE_CARDS, []);
    const o = load(STORAGE_OPS, []);
    setCards(c);
    setOps(o);
    if (c.length) setSelectedCard(c[0].id);
  }, []);

  // Persiste
  useEffect(() => save(STORAGE_CARDS, cards), [cards]);
  useEffect(() => save(STORAGE_OPS, ops), [ops]);

  const currentMonthKey = yyyymm(monthCursor);

  const selected = useMemo(
    () => cards.find((c) => c.id === selectedCard) || null,
    [cards, selectedCard]
  );

  // Lançamentos do mês/ cartão selecionado
  const monthOps = useMemo(() => {
    return ops
      .filter((o) => o.cardId === selectedCard)
      .filter((o) => yyyymm(new Date(o.dateISO)) === currentMonthKey)
      .filter((o) => (onlyPaid ? o.status === "pago" : true))
      .sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO));
  }, [ops, selectedCard, currentMonthKey, onlyPaid]);

  // Totais do mês
  const totals = useMemo(() => {
    const list = ops
      .filter((o) => o.cardId === selectedCard)
      .filter((o) => yyyymm(new Date(o.dateISO)) === currentMonthKey);

    const used = list.reduce((s, o) => s + Math.max(0, +o.amount || 0), 0);
    const pending = list
      .filter((o) => o.status !== "pago")
      .reduce((s, o) => s + Math.max(0, +o.amount || 0), 0);

    const limit = Number(selected?.limit || 0);
    const available = Math.max(0, limit - used);

    return { limit, used, pending, available };
  }, [ops, selected, currentMonthKey]);

  /* ============================
     Ações
  ============================ */
  const addCard = () => {
    const name = cardName.trim();
    const limit = Number(cardLimit || 0);
    if (!name || limit <= 0) return alert("Informe nome e limite do cartão.");
    const id = newId();
    const next = [
      ...cards,
      { id, name, limit, color: cardColor, closeDay: Number(cardClose), dueDay: Number(cardDue) },
    ];
    setCards(next);
    setSelectedCard(id);
    setCardName("");
    setCardLimit("");
  };

  const saveCardSettings = () => {
    if (!selected) return;
    setCards((arr) =>
      arr.map((c) =>
        c.id === selected.id
          ? { ...c, color: cardColor, closeDay: Number(cardClose), dueDay: Number(cardDue) }
          : c
      )
    );
  };

  const deleteCard = (id) => {
    if (!confirm("Excluir este cartão e seus lançamentos?")) return;
    setCards((arr) => arr.filter((c) => c.id !== id));
    setOps((arr) => arr.filter((o) => o.cardId !== id));
    if (selectedCard === id) setSelectedCard("");
  };

  const addOp = () => {
    if (!selected) return alert("Selecione um cartão.");
    const amount = Number(opAmount || 0);
    const parcels = Math.max(1, Number(opParcels || 1));
    if (!opDesc.trim() || amount <= 0) return alert("Informe descrição e valor.");

    const newOp = {
      id: newId(),
      cardId: selected.id,
      dateISO: opDate,
      description: opDesc.trim(),
      amount,
      parcels,
      status: "pendente",
    };
    setOps((arr) => [newOp, ...arr]);

    setOpDesc("");
    setOpAmount("");
    setOpParcels(1);
  };

  const togglePaid = (id) =>
    setOps((arr) =>
      arr.map((o) => (o.id === id ? { ...o, status: o.status === "pago" ? "pendente" : "pago" } : o))
    );

  const editOp = (id) => {
    const item = ops.find((o) => o.id === id);
    if (!item) return;
    const desc = prompt("Descrição:", item.description) ?? item.description;
    const val = Number(prompt("Valor (número):", String(item.amount)) ?? item.amount);
    const dt = prompt("Data (AAAA-MM-DD):", item.dateISO) ?? item.dateISO;
    const pc = Math.max(1, Number(prompt("Parcelas:", String(item.parcels)) ?? item.parcels));
    setOps((arr) =>
      arr.map((o) => (o.id === id ? { ...o, description: desc, amount: val, dateISO: dt, parcels: pc } : o))
    );
  };

  const deleteOp = (id) => {
    if (!confirm("Excluir este lançamento?")) return;
    setOps((arr) => arr.filter((o) => o.id !== id));
  };

  const exportCSV = () => {
    if (!selected) return;
    const rows = [
      ["Cartão", selected.name],
      ["Mês", monthLabelShort(monthCursor)],
      ["Fechamento", selected.closeDay ?? ""],
      ["Vencimento", selected.dueDay ?? ""],
      [],
      ["Data", "Descrição", "Parcela(s)", "Valor", "Status"],
      ...monthOps.map((o) => [
        fmtDateDDMMYY(o.dateISO),
        o.description,
        String(o.parcels),
        (isFinite(+o.amount) ? +o.amount : 0).toString().replace(".", ","),
        o.status,
      ]),
    ];
    const csv =
      "data:text/csv;charset=utf-8," +
      rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = encodeURI(csv);
    a.download = `cartao_${selected.name}_${yyyymm(monthCursor)}.csv`;
    a.click();
  };

  const shiftMonth = (delta) => {
    const d = new Date(monthCursor);
    d.setMonth(d.getMonth() + delta);
    setMonthCursor(d);
  };

  // Sincroniza campos do cartão selecionado
  useEffect(() => {
    if (!selected) return;
    setCardColor(selected.color || "#2563eb");
    setCardClose(selected.closeDay ?? 1);
    setCardDue(selected.dueDay ?? 5);
  }, [selected]);

  /* ============================
     UI
  ============================ */
  return (
    <div className="wrap">
      <h1 className="title">Cartões de Crédito</h1>

      <div className="grid">
        {/* COLUNA ESQUERDA — cartão + fatura (layout “antigo”) */}
        <section className="card">
          {/* Linha cartão + resumo + fechamento/vencimento */}
          <div className="row between wrap-gap">
            <div className="col">
              <label className="lbl">Cartão</label>
              <select
                className="inp"
                value={selectedCard}
                onChange={(e) => setSelectedCard(e.target.value)}
              >
                <option value="">Selecione...</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (limite {currency(c.limit)})
                  </option>
                ))}
              </select>
            </div>

            {selected && (
              <div className="col" style={{ minWidth: 240 }}>
                <label className="lbl">Resumo do mês</label>
                <div className="summary">
                  <div><small>Limite</small><b>{currency(totals.limit)}</b></div>
                  <div><small>Usado</small><b>{currency(totals.used)}</b></div>
                  <div><small>Pendente</small><b>{currency(totals.pending)}</b></div>
                  <div><small>Disponível</small><b>{currency(totals.available)}</b></div>
                </div>
              </div>
            )}

            {selected && (
              <div className="col" style={{ minWidth: 260 }}>
                <label className="lbl">Configuração do cartão</label>
                <div className="row gap8">
                  <div className="col" style={{ width: 110 }}>
                    <label className="lbl">Fechamento</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      className="inp"
                      value={cardClose}
                      onChange={(e) => setCardClose(e.target.value)}
                    />
                  </div>
                  <div className="col" style={{ width: 110 }}>
                    <label className="lbl">Vencimento</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      className="inp"
                      value={cardDue}
                      onChange={(e) => setCardDue(e.target.value)}
                    />
                  </div>
                  <div className="col" style={{ width: 90 }}>
                    <label className="lbl">Cor</label>
                    <input
                      type="color"
                      value={cardColor}
                      onChange={(e) => setCardColor(e.target.value)}
                      style={{ width: 40, height: 36, padding: 0, border: "none", background: "transparent" }}
                    />
                  </div>
                </div>
                <div className="row right mt8">
                  <button className="btn" onClick={saveCardSettings}>Salvar</button>
                </div>
              </div>
            )}
          </div>

          {/* Linha fatura (mês) + opções */}
          <div className="row between mt16 wrap-gap">
            <div className="col">
              <label className="lbl">Fatura</label>
              <div className="pill">
                <button className="btn-sm" onClick={() => shiftMonth(-1)}>◀</button>
                <span>{monthLabelShort(monthCursor)}</span>
                <button className="btn-sm" onClick={() => shiftMonth(1)}>▶</button>
              </div>
            </div>
            <div className="col right">
              <label className="lbl">Opções</label>
              <div className="row gap8">
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={onlyPaid}
                    onChange={(e) => setOnlyPaid(e.target.checked)}
                  />
                  Considerar apenas pagos
                </label>
                <button className="btn" onClick={exportCSV}>Exportar CSV (mês)</button>
              </div>
            </div>
          </div>

          {/* Tabela (com rolagem horizontal própria) */}
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 110, textAlign: "center" }}>Data</th>
                  <th style={{ textAlign: "left" }}>Descrição</th>
                  <th style={{ width: 120, textAlign: "center" }}>Parcela(s)</th>
                  <th style={{ width: 140, textAlign: "center" }}>Valor</th>
                  <th style={{ width: 120, textAlign: "center" }}>Status</th>
                  <th style={{ width: 200, textAlign: "center" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {selected ? (
                  monthOps.length ? (
                    monthOps.map((o) => (
                      <tr key={o.id}>
                        <td style={{ textAlign: "center" }}>{fmtDateDDMMYY(o.dateISO)}</td>
                        <td style={{ textAlign: "left" }}>{o.description}</td>
                        <td style={{ textAlign: "center" }}>{o.parcels}</td>
                        <td style={{ textAlign: "center" }}>{currency(o.amount)}</td>
                        <td style={{ textAlign: "center" }}>
                          <span className={`badge ${o.status === "pago" ? "ok" : "warn"}`}>
                            {o.status === "pago" ? "Pago" : "Pendente"}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div className="row center gap8">
                            <button className="btn-ghost" onClick={() => editOp(o.id)}>Editar</button>
                            <button className="btn-ghost" onClick={() => togglePaid(o.id)}>
                              {o.status === "pago" ? "Marcar pendente" : "Marcar pago"}
                            </button>
                            <button className="btn-danger" onClick={() => deleteOp(o.id)}>Excluir</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "#6b7280" }}>
                        Nenhum lançamento nesta fatura.
                      </td>
                    </tr>
                  )
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "#6b7280" }}>
                      Selecione um cartão para visualizar a fatura e lançar compras.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* COLUNA DIREITA — novo cartão + novo lançamento */}
        <aside className="col-side">
          {/* Novo cartão */}
          <section className="card">
            <h3 className="sec-title">Novo cartão</h3>
            <div className="row gap8 wrap-gap">
              <div className="col">
                <label className="lbl">Nome do cartão</label>
                <input
                  className="inp"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="Ex.: Visa XP"
                />
              </div>
              <div className="col" style={{ maxWidth: 140 }}>
                <label className="lbl">Limite</label>
                <input
                  className="inp"
                  type="number"
                  min="0"
                  value={cardLimit}
                  onChange={(e) => setCardLimit(e.target.value)}
                />
              </div>
            </div>

            <div className="row gap8 wrap-gap mt8">
              <div className="col" style={{ width: 120 }}>
                <label className="lbl">Fechamento</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  className="inp"
                  value={cardClose}
                  onChange={(e) => setCardClose(e.target.value)}
                />
              </div>
              <div className="col" style={{ width: 120 }}>
                <label className="lbl">Vencimento</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  className="inp"
                  value={cardDue}
                  onChange={(e) => setCardDue(e.target.value)}
                />
              </div>
              <div className="col" style={{ width: 120 }}>
                <label className="lbl">Cor</label>
                <input
                  type="color"
                  value={cardColor}
                  onChange={(e) => setCardColor(e.target.value)}
                  style={{ width: 40, height: 36, padding: 0, border: "none", background: "transparent" }}
                />
              </div>
            </div>

            <div className="row right mt12">
              <button className="btn primary" onClick={addCard}>Salvar cartão</button>
            </div>
          </section>

          {/* Nova compra */}
          <section className="card">
            <h3 className="sec-title">Novo lançamento no cartão</h3>
            <div className="row gap8 wrap-gap">
              <div className="col" style={{ width: 140 }}>
                <label className="lbl">Data</label>
                <input
                  type="date"
                  className="inp"
                  value={opDate}
                  onChange={(e) => setOpDate(e.target.value)}
                />
              </div>
              <div className="col" style={{ width: 120 }}>
                <label className="lbl">Parcela(s)</label>
                <input
                  type="number"
                  min="1"
                  className="inp"
                  value={opParcels}
                  onChange={(e) => setOpParcels(e.target.value)}
                />
              </div>
              <div className="col" style={{ width: 160 }}>
                <label className="lbl">Valor</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="inp"
                  value={opAmount}
                  onChange={(e) => setOpAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="row mt8">
              <div className="col" style={{ width: "100%" }}>
                <label className="lbl">Descrição</label>
                <input
                  className="inp"
                  placeholder="Ex.: Supermercado"
                  value={opDesc}
                  onChange={(e) => setOpDesc(e.target.value)}
                />
              </div>
            </div>

            <div className="row right mt12">
              <button className="btn primary" onClick={addOp} disabled={!selected}>
                Adicionar
              </button>
            </div>
          </section>
        </aside>
      </div>

      <style jsx>{`
        .wrap { max-width: 1100px; margin: 0 auto; padding: 16px; }
        .title { font-size: 28px; font-weight: 800; margin: 8px 0 16px; }
        .grid { display: grid; grid-template-columns: 1fr 340px; gap: 16px; }
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; }
        .row { display: flex; align-items: center; }
        .between { justify-content: space-between; }
        .right { justify-content: flex-end; }
        .center { justify-content: center; }
        .gap8 { gap: 8px; }
        .wrap-gap { row-gap: 8px; column-gap: 8px; flex-wrap: wrap; }
        .mt8 { margin-top: 8px; }
        .mt12 { margin-top: 12px; }
        .mt16 { margin-top: 16px; }
        .col { display: flex; flex-direction: column; gap: 6px; }
        .lbl { font-size: 12px; color: #6b7280; }
        .inp {
          height: 36px; padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 8px; outline: none;
        }
        .inp:focus { border-color: #93c5fd; box-shadow: 0 0 0 2px rgba(59,130,246,.15); }
        .btn {
          height: 36px; padding: 0 12px; border: 1px solid #e5e7eb; border-radius: 8px;
          background: #f9fafb; cursor: pointer;
        }
        .btn:hover { background: #f3f4f6; }
        .btn-sm { height: 28px; padding: 0 8px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; cursor: pointer; }
        .btn-ghost { height: 30px; padding: 0 10px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; cursor: pointer; }
        .btn-danger { height: 30px; padding: 0 10px; border: 1px solid #fecaca; border-radius: 8px; background: #fee2e2; color: #b91c1c; cursor: pointer; }
        .btn.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
        .btn.primary:hover { background: #1d4ed8; border-color: #1d4ed8; }
        .chk { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #374151; }
        .pill { display: inline-flex; align-items: center; gap: 8px; padding: 4px 10px; border: 1px solid #e5e7eb; border-radius: 999px; background: #fff; }

        .summary {
          display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px;
          border: 1px dashed #e5e7eb; border-radius: 10px; padding: 8px;
        }

        .table-scroll { margin-top: 12px; overflow-x: auto; }
        .tbl { width: 100%; border-collapse: collapse; }
        .tbl th, .tbl td { padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 14px; white-space: nowrap; }
        .tbl thead th { background: #f8fafc; color: #475569; }
        .badge { display: inline-flex; align-items: center; justify-content: center; min-width: 80px; height: 26px; padding: 0 8px; border-radius: 999px; font-weight: 600; font-size: 12px; }
        .badge.ok { background: #ecfdf5; color: #059669; }
        .badge.warn { background: #fff7ed; color: #c2410c; }

        .col-side { display: grid; gap: 16px; }

        @media (max-width: 1024px) {
          .grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
