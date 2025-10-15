"use client";

import { useEffect, useMemo, useState } from "react";

/** =================== STORAGE KEYS =================== */
const LOANS_KEY = "gf_loans_v1";
const LOAN_SCHEDULE_KEY = "gf_loan_schedule_v1";
const TX_STORAGE_KEY = "gf_transactions_v1";

/** =================== HELPERS =================== */
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
function formatCurrency(n) {
  const v = Number(n || 0);
  return v.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}
function ymNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function addMonthsYM(ym, add) {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(y, m - 1 + add, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

/** Gera cronograma (Price). r = taxa mensal decimal, n = meses */
function buildSchedule({ loanId, principal, monthlyRate, months, startYm }) {
  const rows = [];
  const P = Number(principal || 0);
  const r = Number(monthlyRate || 0) / 100; // % → decimal
  const n = Math.max(1, Number(months || 1));

  // prestação
  const payment = r > 0 ? P * (r / (1 - Math.pow(1 + r, -n))) : P / n;

  let saldo = P;
  for (let i = 0; i < n; i++) {
    const ym = addMonthsYM(startYm, i);
    const juros = r > 0 ? saldo * r : 0;
    const amort = payment - juros;
    const parcela = Math.round(payment * 100) / 100;
    const j = Math.round(juros * 100) / 100;
    const a = Math.round(amort * 100) / 100;

    rows.push({
      id: uid(),
      loanId,
      ym,                // YYYY-MM a que a parcela pertence
      parcela: i + 1,    // 1..n
      nParcelas: n,
      payment: parcela,  // valor da parcela
      juros: j,
      amort: a,
      status: "pendente" // "pago" | "pendente"
    });

    saldo = Math.max(0, saldo - amort);
  }
  return rows;
}

/** =================== PÁGINA =================== */
export default function EmprestimosPage() {
  const [loans, setLoans] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [faturaYm, setFaturaYm] = useState(ymNow());

  // form de novo empréstimo
  const [form, setForm] = useState({
    name: "",
    principal: "",
    months: 12,
    monthlyRate: 2.5, // % ao mês
    startYm: ymNow(), // YYYY-MM
    color: "#0ea5e9",
    registrarEntrada: true, // registra crédito na aba Receitas
  });

  /** carregar LS inicial */
  useEffect(() => {
    setLoans(loadLS(LOANS_KEY, []));
    setSchedule(loadLS(LOAN_SCHEDULE_KEY, []));
  }, []);

  /** empréstimo selecionado */
  const loan = useMemo(
    () => loans.find(l => l.id === selectedLoanId) || null,
    [loans, selectedLoanId]
  );

  /** parcelas do mês atual do empréstimo selecionado */
  const parcelasMes = useMemo(() => {
    if (!loan) return [];
    return schedule
      .filter(p => p.loanId === loan.id && p.ym === faturaYm)
      .sort((a, b) => a.parcela - b.parcela);
  }, [loan, schedule, faturaYm]);

  /** totais do empréstimo selecionado */
  const resumoLoan = useMemo(() => {
    if (!loan) return { total: 0, jurosTotais: 0, saldoDevedor: 0, pagas: 0, pendentes: 0 };
    const rows = schedule.filter(p => p.loanId === loan.id);
    const total = rows.reduce((s, r) => s + r.payment, 0);
    const jurosTotais = rows.reduce((s, r) => s + r.juros, 0);
    const pagas = rows.filter(r => r.status === "pago").length;
    const pendentes = rows.length - pagas;
    const saldoDevedor = rows
      .filter(r => r.status !== "pago")
      .reduce((s, r) => s + r.payment, 0);

    return { total, jurosTotais, saldoDevedor, pagas, pendentes };
  }, [loan, schedule]);

  /** adicionar empréstimo */
  function addLoan(e) {
    e.preventDefault();
    const principal = Number(form.principal || 0);
    const months = Math.max(1, Number(form.months || 1));
    const monthlyRate = Number(form.monthlyRate || 0);
    const startYm = form.startYm;

    const newLoan = {
      id: uid(),
      name: form.name.trim() || "Empréstimo",
      principal,
      months,
      monthlyRate, // %/mês
      startYm,
      color: form.color || "#0ea5e9",
      createdAt: Date.now(),
    };

    // gera schedule
    const rows = buildSchedule({
      loanId: newLoan.id,
      principal,
      monthlyRate,
      months,
      startYm,
    });

    const nextLoans = [...loans, newLoan];
    const nextSched = [...schedule, ...rows];

    setLoans(nextLoans);
    setSchedule(nextSched);
    saveLS(LOANS_KEY, nextLoans);
    saveLS(LOAN_SCHEDULE_KEY, nextSched);
    setSelectedLoanId(newLoan.id);

    // registra ENTRADA (crédito recebido) em Despesas & Receitas, se marcado
    if (form.registrarEntrada && principal > 0) {
      const txs = loadLS(TX_STORAGE_KEY, []);
      const dataISO = `${startYm}-05`;
      const tx = {
        id: uid(),
        data: dataISO,
        descricao: `Crédito recebido – ${newLoan.name}`,
        categoria: "Empréstimos",
        tipo: "entrada",
        valor: principal,
        status: "pago",
        createdAt: new Date().toISOString(),
      };
      const txNext = [...txs, tx];
      saveLS(TX_STORAGE_KEY, txNext);
      alert("Entrada do empréstimo registrada na aba Despesas & Receitas ✓");
    }

    // limpa form
    setForm({
      name: "",
      principal: "",
      months: 12,
      monthlyRate: 2.5,
      startYm: ymNow(),
      color: "#0ea5e9",
      registrarEntrada: true,
    });
  }

  /** excluir empréstimo */
  function deleteLoan(id) {
    if (!confirm("Excluir este empréstimo e todas as suas parcelas?")) return;
    const nextLoans = loans.filter(l => l.id !== id);
    const nextSched = schedule.filter(p => p.loanId !== id);
    setLoans(nextLoans);
    setSchedule(nextSched);
    saveLS(LOANS_KEY, nextLoans);
    saveLS(LOAN_SCHEDULE_KEY, nextSched);
    if (selectedLoanId === id) setSelectedLoanId("");
  }

  /** marcar parcela paga/pendente + registrar SAÍDA quando marcar pago */
  function toggleParcela(pId) {
    const rows = schedule.map(r => {
      if (r.id !== pId) return r;
      const novo = { ...r, status: r.status === "pago" ? "pendente" : "pago" };

      // registramos SAÍDA apenas quando virou "pago" agora
      if (r.status !== "pago" && novo.status === "pago") {
        const txs = loadLS(TX_STORAGE_KEY, []);
        const dataISO = `${r.ym}-05`;
        const refLoan = loans.find(l => l.id === r.loanId);
        const tx = {
          id: uid(),
          data: dataISO,
          descricao: `Parcela ${r.parcela}/${r.nParcelas} – ${refLoan?.name || "Empréstimo"}`,
          categoria: "Empréstimos",
          tipo: "saida",
          valor: r.payment,
          status: "pago",
          createdAt: new Date().toISOString(),
        };
        saveLS(TX_STORAGE_KEY, [...txs, tx]);
      }
      return novo;
    });
    setSchedule(rows);
    saveLS(LOAN_SCHEDULE_KEY, rows);
  }

  /** export CSV do mês */
  function exportCSV() {
    if (!loan) return;
    const items = parcelasMes;
    const header = ["Mês", "Parcela", "Valor", "Juros", "Amortização", "Status"];
    const lines = items.map(p => [
      p.ym,
      `${p.parcela}/${p.nParcelas}`,
      p.payment.toFixed(2).replace(".", ","),
      p.juros.toFixed(2).replace(".", ","),
      p.amort.toFixed(2).replace(".", ","),
      p.status === "pago" ? "Pago" : "Pendente",
    ]);
    const content = [header, ...lines].map(arr => arr.join(";")).join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `emprestimo_${loan.name}_${faturaYm}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** navegação mês */
  const prevYm = () => setFaturaYm(addMonthsYM(faturaYm, -1));
  const nextYm = () => setFaturaYm(addMonthsYM(faturaYm, 1));

  /** cálculos instantâneos do formulário */
  const calcPreview = useMemo(() => {
    const P = Number(form.principal || 0);
    const n = Math.max(1, Number(form.months || 1));
    const r = Number(form.monthlyRate || 0) / 100;
    const prest = r > 0 ? P * (r / (1 - Math.pow(1 + r, -n))) : P / n;
    const total = prest * n;
    const juros = total - P;
    return {
      prestacao: Math.round(prest * 100) / 100,
      total: Math.round(total * 100) / 100,
      juros: Math.round(juros * 100) / 100,
    };
  }, [form.principal, form.months, form.monthlyRate]);

  /** =================== UI =================== */
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Empréstimos</h1>

      {/* GRID TOPO: seleção + formulário */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Seleção / Resumo */}
        <div className="card" style={cardBox}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ fontWeight: 600 }}>Empréstimo</label>
            <select
              value={selectedLoanId}
              onChange={e => setSelectedLoanId(e.target.value)}
              style={input}
            >
              <option value="">Selecione...</option>
              {loans.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name} — {formatCurrency(l.principal)} ({l.months}x, {l.monthlyRate}% a.m.)
                </option>
              ))}
            </select>
            {loan && (
              <button onClick={() => deleteLoan(loan.id)} style={btnDanger}>
                Excluir empréstimo
              </button>
            )}
          </div>

          {loan && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(120px, 1fr))",
                gap: 12,
                marginTop: 14,
              }}
            >
              <InfoPill label="Valor" value={formatCurrency(loan.principal)} color={loan.color} />
              <InfoPill label="Prestação" value={formatCurrency(schedule.find(s => s.loanId === loan.id)?.payment || 0)} />
              <InfoPill label="Juros Totais" value={formatCurrency(resumoLoan.jurosTotais)} />
              <InfoPill label="Saldo devedor" value={formatCurrency(resumoLoan.saldoDevedor)} />
              <InfoPill label="Parcelas" value={`${resumoLoan.pagas}/${loan.months} pagas`} />
            </div>
          )}
        </div>

        {/* Formulário novo empréstimo */}
        <form onSubmit={addLoan} className="card" style={cardBox}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Novo empréstimo</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              style={input}
              placeholder="Nome (ex.: Banco XP)"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              required
            />
            <input
              style={input}
              placeholder="Valor (principal)"
              value={form.principal}
              onChange={e => setForm(p => ({ ...p, principal: e.target.value }))}
              inputMode="decimal"
              required
            />
            <input
              style={input}
              placeholder="Meses"
              value={form.months}
              onChange={e => setForm(p => ({ ...p, months: Number(e.target.value || 1) }))}
              inputMode="numeric"
              required
            />
            <input
              style={input}
              placeholder="Juros mês (%)"
              value={form.monthlyRate}
              onChange={e => setForm(p => ({ ...p, monthlyRate: Number(e.target.value || 0) }))}
              inputMode="decimal"
              required
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, opacity: .7 }}>1ª parcela</span>
              <input
                type="month"
                value={form.startYm}
                onChange={e => setForm(p => ({ ...p, startYm: e.target.value }))}
                style={input}
                required
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, opacity: .7 }}>Cor</span>
              <input
                type="color"
                value={form.color}
                onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={form.registrarEntrada}
                onChange={e => setForm(p => ({ ...p, registrarEntrada: e.target.checked }))}
              />
              Registrar crédito em “Despesas & Receitas”
            </label>
          </div>

          {/* preview de cálculo */}
          <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
            <Badge label="Prestação" value={formatCurrency(calcPreview.prestacao)} />
            <Badge label="Total a pagar" value={formatCurrency(calcPreview.total)} />
            <Badge label="Juros totais" value={formatCurrency(calcPreview.juros)} />
          </div>

          <div style={{ marginTop: 10 }}>
            <button type="submit" style={btnPrimary}>Salvar empréstimo</button>
          </div>
        </form>
      </div>

      {/* Fatura/mês do empréstimo selecionado */}
      {loan ? (
        <div className="card" style={cardBox}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 10, height: 10, borderRadius: 999, background: loan.color,
              boxShadow: "0 0 0 2px rgba(0,0,0,.06)"
            }} />
            <div style={{ fontWeight: 700 }}>{loan.name}</div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={prevYm} style={btnSoft}>«</button>
              <input
                type="month"
                value={faturaYm}
                onChange={e => setFaturaYm(e.target.value)}
                style={input}
                aria-label="Mês"
              />
              <button onClick={nextYm} style={btnSoft}>»</button>
              <button onClick={exportCSV} style={btnSoft}>Exportar CSV</button>
            </div>
          </div>

          <div style={{ marginTop: 8, fontSize: 13, opacity: .75 }}>
            Parcelas de <b>{faturaYm}</b> — Total do mês:{" "}
            <b>{formatCurrency(parcelasMes.reduce((s, p) => s + p.payment, 0))}</b>
          </div>

          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table style={table}>
              <thead>
                <tr>
                  <th>Parcela</th>
                  <th>Valor</th>
                  <th>Juros</th>
                  <th>Amortização</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {parcelasMes.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 16, textAlign: "center", opacity: .6 }}>
                      Sem parcelas neste mês.
                    </td>
                  </tr>
                ) : parcelasMes.map(p => (
                  <tr key={p.id}>
                    <td>{p.parcela}/{p.nParcelas}</td>
                    <td>{formatCurrency(p.payment)}</td>
                    <td>{formatCurrency(p.juros)}</td>
                    <td>{formatCurrency(p.amort)}</td>
                    <td>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: p.status === "pago" ? "#dcfce7" : "#fee2e2",
                        color: p.status === "pago" ? "#166534" : "#991b1b",
                        fontSize: 12,
                      }}>
                        {p.status === "pago" ? "Pago" : "Pendente"}
                      </span>
                    </td>
                    <td>
                      <button style={btnSoft} onClick={() => toggleParcela(p.id)}>
                        {p.status === "pago" ? "Marcar pendente" : "Marcar pago"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card" style={{ ...cardBox, marginTop: 16 }}>
          Selecione um empréstimo para ver o cronograma e registrar pagamentos.
        </div>
      )}
    </div>
  );
}

/** =================== UI TOKENS =================== */
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
const thtd = {
  borderBottom: "1px solid #e5e7eb",
  textAlign: "left",
  padding: "10px 8px",
};
const oldCreateElement = document.createElement;
const styleTag = typeof document !== "undefined" ? (() => {
  const s = oldCreateElement.call(document, "style");
  s.innerHTML = `
    table th, table td { ${Object.entries(thtd).map(([k,v]) => `${k}:${v}`).join(";")} }
  `;
  document.head.appendChild(s);
  return s;
})() : null;

const btnBase = {
  height: 34,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid transparent",
  cursor: "pointer",
};
const btnPrimary = { ...btnBase, background: "#2563eb", color: "#fff", borderColor: "#1d4ed8" };
const btnSoft    = { ...btnBase, background: "#f3f4f6", color: "#111827", borderColor: "#e5e7eb" };
const btnDanger  = { ...btnBase, background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" };

function InfoPill({ label, value, color }) {
  return (
    <div style={{
      display: "grid",
      gap: 2,
      padding: "8px 10px",
      border: `1px solid ${color || "#e5e7eb"}`,
      borderRadius: 12,
      minWidth: 120,
      background: "#f9fafb",
    }}>
      <span style={{ fontSize: 12, opacity: 0.7 }}>{label}</span>
      <b style={{ fontSize: 15 }}>{value}</b>
    </div>
  );
}
function Badge({ label, value }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 10px", background: "#f3f4f6",
      border: "1px solid #e5e7eb", borderRadius: 999, fontSize: 13
    }}>
      <span style={{ opacity: .7 }}>{label}</span>
      <b>{value}</b>
    </div>
  );
}
