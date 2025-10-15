"use client";

import React, { useEffect, useMemo, useState } from "react";

/* ===================== LocalStorage Keys ===================== */
const LOANS_KEY = "gf_loans_v1";
const LOAN_SCHEDULE_KEY = "gf_loan_schedule_v1";
const TX_STORAGE_KEY = "gf_transactions_v1";

/* ===================== Helpers ===================== */
function loadLS(key, fallback) {
  try {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem(key) : null;
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
function fmtCurrency(n) {
  const v = Number(n || 0);
  return v.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}
function ymAdd(ym, add) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + add, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function toDateISO(ym, day = 1) {
  return `${ym}-${String(day).padStart(2, "0")}`;
}
function todayYm() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Calcula parcela (sistema Price).
 * principal: valor emprestado
 * rate: juros ao mês (ex.: 2.5 => 2.5%)
 * n: número de meses
 */
function calcPriceInstallment(principal, ratePercent, n) {
  const i = Number(ratePercent || 0) / 100;
  if (!n || n <= 0) return 0;
  if (i === 0) return principal / n;
  const f = (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
  return principal * f;
}

/* CSV simples para o plano */
function scheduleToCSV(rows) {
  const head = [
    "Mês",
    "Parcela",
    "Prestação",
    "Juros",
    "Amortização",
    "Saldo Devedor",
    "Status",
  ];
  const lines = rows.map((r) => [
    r.ym,
    `${r.index}/${r.count}`,
    String(r.payment).replace(".", ","),
    String(r.interest).replace(".", ","),
    String(r.principalPart).replace(".", ","),
    String(r.balance).replace(".", ","),
    r.status === "pago" ? "Pago" : "Pendente",
  ]);
  return [head, ...lines].map((arr) => arr.join(";")).join("\n");
}

/* ===================== Página ===================== */
export default function EmprestimosPage() {
  /* dados */
  const [loans, setLoans] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [mesFiltro, setMesFiltro] = useState(todayYm());

  /* form novo empréstimo */
  const [form, setForm] = useState({
    name: "",
    principal: "",
    months: 12,
    rate: 2.5, // % a.m.
    startYm: todayYm(),
    color: "#0ea5e9",
    registrarEntrada: true, // registrar crédito em Receitas
  });

  /* carregar LS */
  useEffect(() => {
    setLoans(loadLS(LOANS_KEY, []));
    setSchedule(loadLS(LOAN_SCHEDULE_KEY, []));
  }, []);

  /* empréstimo selecionado */
  const loan = useMemo(
    () => loans.find((l) => l.id === selectedId) || null,
    [loans, selectedId]
  );

  /* resumo calculado */
  const resumo = useMemo(() => {
    if (!loan) return null;
    const rows = schedule
      .filter((r) => r.loanId === loan.id)
      .sort((a, b) => a.index - b.index);

    const payment = rows[0]?.payment || 0;
    const totalPago = rows.reduce((s, r) => s + r.payment, 0);
    const totalJuros = rows.reduce((s, r) => s + r.interest, 0);

    return {
      payment,
      totalPago,
      totalJuros,
      totalGeral: totalPago,
    };
  }, [loan, schedule]);

  /* parcelas do mês filtrado */
  const parcelasMes = useMemo(() => {
    if (!loan) return [];
    return schedule
      .filter((r) => r.loanId === loan.id && r.ym === mesFiltro)
      .sort((a, b) => a.index - b.index);
  }, [loan, schedule, mesFiltro]);

  /* ====== ações ====== */

  function adicionarEmprestimo(e) {
    e.preventDefault();

    const principal = Number(form.principal || 0);
    const months = Math.max(1, Number(form.months || 1));
    const rate = Number(form.rate || 0);

    if (principal <= 0) {
      alert("Informe um valor de empréstimo maior que zero.");
      return;
    }

    const id = uid();

    const payment = Math.round(calcPriceInstallment(principal, rate, months) * 100) / 100;

    // gera plano (Price)
    let saldo = principal;
    const rows = [];
    for (let i = 1; i <= months; i++) {
      const ym = ymAdd(form.startYm, i - 1);
      const interest = Math.round(saldo * (rate / 100) * 100) / 100;
      let principalPart = Math.round((payment - interest) * 100) / 100;

      // última parcela: ajusta arredondamento para zerar saldo
      if (i === months) {
        principalPart = Math.round(saldo * 100) / 100;
      }

      saldo = Math.round((saldo - principalPart) * 100) / 100;

      rows.push({
        id: uid(),
        loanId: id,
        ym,
        index: i,
        count: months,
        payment,
        interest,
        principalPart,
        balance: Math.max(0, saldo),
        status: "pendente",
      });
    }

    const novo = {
      id,
      name: form.name.trim() || "Empréstimo",
      principal,
      months,
      rate,
      startYm: form.startYm,
      color: form.color || "#0ea5e9",
      createdAt: Date.now(),
    };

    const loansNext = [...loans, novo];
    const scheduleNext = [...schedule, ...rows];

    setLoans(loansNext);
    setSchedule(scheduleNext);
    saveLS(LOANS_KEY, loansNext);
    saveLS(LOAN_SCHEDULE_KEY, scheduleNext);
    setSelectedId(id);

    // registra crédito (entrada) na aba Despesas & Receitas
    if (form.registrarEntrada) {
      const txs = loadLS(TX_STORAGE_KEY, []);
      const entrada = {
        id: uid(),
        data: toDateISO(form.startYm, 1),
        descricao: `Crédito recebido – ${novo.name}`,
        categoria: "Crédito/Empréstimo",
        tipo: "entrada",
        valor: principal,
        status: "pago",
        createdAt: new Date().toISOString(),
      };
      saveLS(TX_STORAGE_KEY, [...txs, entrada]);
      // aviso discreto
      setTimeout(() => alert("Entrada registrada em Despesas & Receitas ✓"), 10);
    }

    // limpa form
    setForm({
      name: "",
      principal: "",
      months: 12,
      rate: 2.5,
      startYm: todayYm(),
      color: "#0ea5e9",
      registrarEntrada: true,
    });
  }

  function excluirEmprestimo(id) {
    if (!confirm("Excluir este empréstimo e todas as parcelas?")) return;
    const nextLoans = loans.filter((l) => l.id !== id);
    const nextSchedule = schedule.filter((s) => s.loanId !== id);
    setLoans(nextLoans);
    setSchedule(nextSchedule);
    saveLS(LOANS_KEY, nextLoans);
    saveLS(LOAN_SCHEDULE_KEY, nextSchedule);
    if (selectedId === id) setSelectedId("");
  }

  function toggleParcelaStatus(id) {
    const next = schedule.map((r) =>
      r.id === id ? { ...r, status: r.status === "pago" ? "pendente" : "pago" } : r
    );
    setSchedule(next);
    saveLS(LOAN_SCHEDULE_KEY, next);
  }

  function exportarCSVPlano() {
    if (!loan) return;
    const rows = schedule
      .filter((r) => r.loanId === loan.id)
      .sort((a, b) => a.index - b.index);
    const csv = scheduleToCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `emprestimo_${loan.name}_plano.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  }

  function registrarPagamentoMes() {
    if (!loan) return;
    const linhas = parcelasMes;
    if (linhas.length === 0) {
      alert("Não há parcela para este mês.");
      return;
    }
    const totalMes = linhas.reduce((s, r) => s + r.payment, 0);
    if (totalMes <= 0) {
      alert("Valor inválido.");
      return;
    }
    if (!confirm(`Registrar pagamento de ${fmtCurrency(totalMes)} em Despesas?`)) return;

    const txs = loadLS(TX_STORAGE_KEY, []);
    const saida = {
      id: uid(),
      data: toDateISO(mesFiltro, 5),
      descricao: `Parcela empréstimo – ${loan.name} (${mesFiltro})`,
      categoria: "Empréstimos",
      tipo: "saida",
      valor: totalMes,
      status: "pago",
      createdAt: new Date().toISOString(),
    };
    saveLS(TX_STORAGE_KEY, [...txs, saida]);
    alert("Pagamento registrado em Despesas & Receitas ✓");
  }

  /* ===================== UI ===================== */
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>
        Empréstimos
      </h1>

      {/* Topo: seleção + resumo + novo empréstimo */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16 }}>
        {/* Seleção + resumo */}
        <div style={cardBox}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ fontWeight: 600 }}>Empréstimo</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              style={input}
              aria-label="Selecionar empréstimo"
            >
              <option value="">Selecione...</option>
              {loans.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — {fmtCurrency(l.principal)}
                </option>
              ))}
            </select>
            {loan && (
              <button style={btnDanger} onClick={() => excluirEmprestimo(loan.id)}>
                Excluir
              </button>
            )}
            <div style={{ marginLeft: "auto" }}>
              {loan && (
                <span
                  title="Cor do empréstimo"
                  style={{
                    display: "inline-block",
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: loan.color || "#0ea5e9",
                    border: "1px solid #e5e7eb",
                  }}
                />
              )}
            </div>
          </div>

          {loan && resumo && (
            <div
              style={{
                display: "flex",
                gap: 16,
                marginTop: 12,
                flexWrap: "wrap",
              }}
            >
              <InfoPill label="Valor" value={fmtCurrency(loan.principal)} color={loan.color} />
              <InfoPill label="Meses" value={loan.months} color={loan.color} />
              <InfoPill label="Juros a.m." value={`${loan.rate}%`} color={loan.color} />
              <InfoPill label="Prestação" value={fmtCurrency(resumo.payment)} color={loan.color} />
              <InfoPill label="Total Juros" value={fmtCurrency(resumo.totalJuros)} color={loan.color} />
              <InfoPill label="Total Pago" value={fmtCurrency(resumo.totalGeral)} color={loan.color} />
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button style={btnSoft} onClick={exportarCSVPlano}>Exportar CSV (plano)</button>
              </div>
            </div>
          )}
        </div>

        {/* Novo empréstimo */}
        <form onSubmit={adicionarEmprestimo} style={cardBox}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Novo empréstimo</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              style={input}
              placeholder="Nome (ex.: Banco X)"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <input
              style={input}
              placeholder="Valor"
              value={form.principal}
              onChange={(e) => setForm((p) => ({ ...p, principal: e.target.value }))}
              inputMode="decimal"
              required
            />
            <input
              style={input}
              placeholder="Meses"
              value={form.months}
              onChange={(e) => setForm((p) => ({ ...p, months: Number(e.target.value || 1) }))}
              inputMode="numeric"
              required
            />
            <input
              style={input}
              placeholder="Juros a.m. (%)"
              value={form.rate}
              onChange={(e) => setForm((p) => ({ ...p, rate: Number(e.target.value || 0) }))}
              inputMode="decimal"
              required
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, opacity: 0.7 }}>Início</span>
              <input
                type="month"
                value={form.startYm}
                onChange={(e) => setForm((p) => ({ ...p, startYm: e.target.value }))}
                style={input}
                required
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, opacity: 0.7 }}>Cor</span>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
              />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, gridColumn: "1 / -1", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={form.registrarEntrada}
                onChange={(e) => setForm((p) => ({ ...p, registrarEntrada: e.target.checked }))}
              />
              Registrar automaticamente o crédito em <b>Despesas & Receitas</b> (Entrada)
            </label>
          </div>

          {/* Preview da prestação */}
          <div style={{ marginTop: 8, fontSize: 13, color: "#374151" }}>
            Prestação estimada:{" "}
            <b>
              {fmtCurrency(
                Math.round(calcPriceInstallment(Number(form.principal || 0), Number(form.rate || 0), Math.max(1, Number(form.months || 1))) * 100) / 100
              )}
            </b>
          </div>

          <div style={{ marginTop: 10 }}>
            <button type="submit" style={btnPrimary}>Salvar empréstimo</button>
          </div>
        </form>
      </div>

      {/* Fatura / parcelas do mês */}
      {loan ? (
        <div style={{ ...cardBox, marginTop: 16, borderColor: loan.color || "#0ea5e9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontWeight: 700 }}>Parcelas do mês</div>
            <input
              type="month"
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              style={input}
              aria-label="Mês"
            />
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button style={btnSuccess} onClick={registrarPagamentoMes}>
                Registrar pagamento do mês em Despesas
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={thtd}>Mês</th>
                  <th style={thtd}>Parcela</th>
                  <th style={thtd}>Prestação</th>
                  <th style={thtd}>Juros</th>
                  <th style={thtd}>Amortização</th>
                  <th style={thtd}>Saldo</th>
                  <th style={thtd}>Status</th>
                  <th style={thtd}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {parcelasMes.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 16, textAlign: "center", opacity: 0.6 }}>
                      Nenhuma parcela neste mês.
                    </td>
                  </tr>
                ) : (
                  parcelasMes.map((r) => (
                    <tr key={r.id}>
                      <td style={tdd}>{r.ym}</td>
                      <td style={tdd}>{r.index}/{r.count}</td>
                      <td style={tdd}>{fmtCurrency(r.payment)}</td>
                      <td style={tdd}>{fmtCurrency(r.interest)}</td>
                      <td style={tdd}>{fmtCurrency(r.principalPart)}</td>
                      <td style={tdd}>{fmtCurrency(r.balance)}</td>
                      <td style={tdd}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: r.status === "pago" ? "#dcfce7" : "#fee2e2",
                            color: r.status === "pago" ? "#166534" : "#991b1b",
                            fontSize: 12,
                          }}
                        >
                          {r.status === "pago" ? "Pago" : "Pendente"}
                        </span>
                      </td>
                      <td style={tdd}>
                        <button style={btnSoft} onClick={() => toggleParcelaStatus(r.id)}>
                          {r.status === "pago" ? "Marcar pendente" : "Marcar pago"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ ...cardBox, marginTop: 16 }}>Selecione um empréstimo para visualizar o plano.</div>
      )}
    </div>
  );
}

/* ===================== UI tokens ===================== */
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
  borderSpacing: 0,
};

const thtd = {
  borderBottom: "1px solid #e5e7eb",
  textAlign: "left",
  padding: "10px 8px",
};

const tdd = { padding: "8px 8px", borderBottom: "1px solid #f3f4f6" };

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
const btnDanger = {
  ...btnBase,
  background: "#fee2e2",
  color: "#991b1b",
  borderColor: "#fecaca",
};
const btnSuccess = {
  ...btnBase,
  background: "#16a34a",
  color: "#fff",
  borderColor: "#15803d",
};

/* Badge de informação com cor do empréstimo no traço */
function InfoPill({ label, value, color = "#0ea5e9" }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 2,
        padding: "8px 10px",
        border: `1px solid ${color}`,
        borderRadius: 12,
        minWidth: 130,
        background: "#f9fafb",
      }}
    >
      <span style={{ fontSize: 12, opacity: 0.7 }}>{label}</span>
      <b style={{ fontSize: 15 }}>{value}</b>
    </div>
  );
}
