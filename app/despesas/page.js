"use client";

import { useEffect, useMemo, useState } from "react";
import categorias from "../../data/categorias.json";

// —— helpers ——
const STORAGE_KEY = "gf_transactions_v2";

function loadTransactions() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTransactions(list) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function currency(n) {
  try {
    return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n);
  } catch {
    return Number(n ?? 0).toFixed(2);
  }
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default function DespesasReceitas() {
  const [txs, setTxs] = useState([]);
  const [form, setForm] = useState({
    data: todayISO(),
    descricao: "",
    categoria: "",
    tipo: "saída",
    valor: "",
    status: "pago",
  });

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const [fTipo, setFTipo] = useState("todas");
  const [fCategoria, setFCategoria] = useState("todas");
  const [fMes, setFMes] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    const loaded = loadTransactions();
    const withStatus = loaded.map((t) => (t.status ? t : { ...t, status: "pago" }));
    setTxs(withStatus);
  }, []);

  useEffect(() => {
    saveTransactions(txs);
  }, [txs]);

  const categoriasSelect = useMemo(() => {
    return [
      ...categorias.entradas,
      ...categorias.saidas_fixas,
      ...categorias.saidas_variaveis,
    ];
  }, []);

  function addTx() {
    const v = parseFloat(String(form.valor).replace(",", "."));
    if (!form.descricao || !form.categoria || !form.data || !form.tipo || isNaN(v) || v <= 0) {
      alert("Preencha: descrição, data, categoria, tipo e um valor maior que 0.");
      return;
    }
    const novo = {
      id: Math.random().toString(36).slice(2),
      data: form.data,
      descricao: form.descricao.trim(),
      categoria: form.categoria,
      tipo: form.tipo,
      valor: v,
      status: form.status,
      criadoEm: new Date().toISOString(),
    };
    setTxs((prev) => [novo, ...prev].sort((a, b) => (a.data < b.data ? 1 : -1)));
    setForm((f) => ({
      ...f,
      descricao: "",
      valor: "",
      data: todayISO(),
    }));
  }

  function delTx(id) {
    if (!confirm("Apagar este lançamento?")) return;
    setTxs((prev) => prev.filter((t) => t.id !== id));
    if (editId === id) {
      setEditId(null);
      setEditForm(null);
    }
  }

  function startEdit(t) {
    setEditId(t.id);
    setEditForm({ ...t, valor: String(t.valor) });
  }

  function cancelEdit() {
    setEditId(null);
    setEditForm(null);
  }

  function saveEdit() {
    const v = parseFloat(String(editForm.valor).replace(",", "."));
    if (!editForm.descricao || !editForm.categoria || !editForm.data || !editForm.tipo || isNaN(v) || v <= 0) {
      alert("Preencha: descrição, data, categoria, tipo e um valor maior que 0.");
      return;
    }
    setTxs((prev) =>
      prev
        .map((t) => (t.id === editId ? { ...editForm, valor: v } : t))
        .sort((a, b) => (a.data < b.data ? 1 : -1))
    );
    setEditId(null);
    setEditForm(null);
  }

  function toggleStatus(id) {
    setTxs((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: t.status === "pago" ? "pendente" : "pago" } : t
      )
    );
  }

  const txsFiltradas = useMemo(() => {
    return txs.filter((t) => {
      const okTipo = fTipo === "todas" ? true : t.tipo === fTipo;
      const okCat = fCategoria === "todas" ? true : t.categoria === fCategoria;
      const okMes = fMes === "tudo" ? true : t.data.startsWith(fMes);
      return okTipo && okCat && okMes;
    });
  }, [txs, fTipo, fCategoria, fMes]);

  const totalEntradaPrev = useMemo(
    () => txsFiltradas.filter(t => t.tipo === "entrada").reduce((s, t) => s + t.valor, 0),
    [txsFiltradas]
  );
  const totalSaidaPrev = useMemo(
    () => txsFiltradas.filter(t => t.tipo === "saída").reduce((s, t) => s + t.valor, 0),
    [txsFiltradas]
  );
  const saldoPrev = totalEntradaPrev - totalSaidaPrev;

  const totalEntradaReal = useMemo(
    () => txsFiltradas.filter(t => t.tipo === "entrada" && t.status === "pago").reduce((s, t) => s + t.valor, 0),
    [txsFiltradas]
  );
  const totalSaidaReal = useMemo(
    () => txsFiltradas.filter(t => t.tipo === "saída" && t.status === "pago").reduce((s, t) => s + t.valor, 0),
    [txsFiltradas]
  );
  const saldoReal = totalEntradaReal - totalSaidaReal;

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Despesas & Receitas</h2>

      {/* —— Formulário —— */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Novo lançamento</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 8,
            alignItems: "end",
          }}
        >
          <div>
            <label className="lbl">Descrição</label>
            <input
              className="inp"
              placeholder="Ex.: Salário, Aluguel, Mercado..."
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>

          <div>
            <label className="lbl">Data</label>
            <input
              className="inp"
              type="date"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
            />
          </div>

          <div>
            <label className="lbl">Categoria</label>
            <select
              className="inp"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            >
              <option value="">Selecionar…</option>
              {categoriasSelect.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="lbl">Tipo</label>
            <select
              className="inp"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            >
              <option value="entrada">Entrada</option>
              <option value="saída">Saída</option>
            </select>
          </div>

          <div>
            <label className="lbl">Valor</label>
            <input
              className="inp"
              type="number"
              step="0.01"
              placeholder="0,00"
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
            />
          </div>

          <div>
            <label className="lbl">Status</label>
            <select
              className="inp"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="pago">Pago</option>
              <option value="pendente">Pendente</option>
            </select>
          </div>

          <div>
            <button className="btn" onClick={addTx}>Adicionar</button>
          </div>
        </div>
      </div>

      {/* —— Filtros + Totais —— */}
      <div className="card" style={{ marginBottom: 12 }}>
        {/* filtros */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 8,
          }}
        >
          <div>
            <label className="lbl">Tipo</label>
            <select className="inp" value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
              <option value="todas">Todas</option>
              <option value="entrada">Entrada</option>
              <option value="saída">Saída</option>
            </select>
          </div>

          <div>
            <label className="lbl">Categoria</label>
            <select className="inp" value={fCategoria} onChange={(e) => setFCategoria(e.target.value)}>
              <option value="todas">Todas</option>
              {categoriasSelect.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="lbl">Mês</label>
            <input
              className="inp"
              type="month"
              value={fMes}
              onChange={(e) => setFMes(e.target.value || "tudo")}
            />
            <div style={{ marginTop: 4 }}>
              <label style={{ fontSize: 12 }}>
                <input
                  type="checkbox"
                  onChange={(e) => setFMes(e.target.checked ? "tudo" : todayISO().slice(0, 7))}
                  checked={fMes === "tudo"}
                />{" "}
                Mostrar todos os meses
              </label>
            </div>
          </div>
        </div>

        {/* Totais */}
        <div className="stats compact" style={{ marginTop: 10 }}>
          <div className="stat">
            <div className="row">
              <span className="muted">Entradas (Prev.)</span>
              <span className="val">{currency(totalEntradaPrev)}</span>
            </div>
            <div className="row">
              <span className="muted">Entradas (Reais)</span>
              <span className="val positivo">{currency(totalEntradaReal)}</span>
            </div>
          </div>

          <div className="stat">
            <div className="row">
              <span className="muted">Saídas (Prev.)</span>
              <span className="val saida">{currency(totalSaidaPrev)}</span>
            </div>
            <div className="row">
              <span className="muted">Saídas (Reais)</span>
              <span className="val saida">{currency(totalSaidaReal)}</span>
            </div>
          </div>

          <div className="stat">
            <div className="row">
              <span className="muted">Saldo Previsto</span>
              <span className={`val ${saldoPrev >= 0 ? "positivo" : "negativo"}`}>
                {currency(saldoPrev)}
              </span>
            </div>
            <div className="row">
              <span className="muted">Saldo Real</span>
              <span className={`val ${saldoReal >= 0 ? "positivo" : "negativo"}`}>
                {currency(saldoReal)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* —— Tabela —— */}
      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <th className="th">Data</th>
                <th className="th">Descrição</th>
                <th className="th">Categoria</th>
                <th className="th">Tipo</th>
                <th className="th" style={{ textAlign: "right" }}>Valor</th>
                <th className="th">Status</th>
                <th className="th" style={{ textAlign: "center" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {txsFiltradas.length === 0 ? (
                <tr>
                  <td className="td" colSpan={7} style={{ textAlign: "center", color: "#6b7280" }}>
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              ) : (
                txsFiltradas.map((t) => (
                  <tr key={t.id} className="tr">
                    <td className="td">{new Date(t.data + "T00:00:00").toLocaleDateString("pt-PT")}</td>
                    <td className="td">{t.descricao}</td>
                    <td className="td">{t.categoria}</td>
                    <td className="td">{t.tipo}</td>
                    <td className="td" style={{ textAlign: "right", color: t.tipo === "entrada" ? "#065f46" : "#b91c1c" }}>
                      {t.tipo === "saída" ? "-" : "+"}{currency(t.valor)}
                    </td>
                    <td className="td">
                      <span className={`badge ${t.status === "pago" ? "ok" : "pend"}`}>
                        {t.status === "pago" ? "Pago" : "Pendente"}
                      </span>
                    </td>
                    <td className="td" style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                      <button className="btn-sm" onClick={() => startEdit(t)}>Editar</button>{" "}
                      <button className="btn-sm" onClick={() => toggleStatus(t.id)}>
                        {t.status === "pago" ? "Marcar pendente" : "Marcar pago"}
                      </button>{" "}
                      <button className="btn-sm danger" onClick={() => delTx(t.id)}>Excluir</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* —— CSS —— */}
      <style jsx>{`
        .lbl{display:block;font-size:12px;color:#6b7280;margin-bottom:6px;}
        .inp{width:100%;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;}
        .btn{width:100%;padding:10px 12px;border:0;border-radius:8px;background:#0ea5e9;color:#fff;cursor:pointer;font-weight:600;}
        .btn:hover{opacity:.9;}
        .btn-sm{padding:6px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;cursor:pointer;font-size:14px;}
        .btn-sm:hover{background:#f3f4f6;}
        .btn-sm.danger{border-color:#fecaca;color:#b91c1c;}
        .th,.td{padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:left;font-size:14px;}
        .tr:nth-child(even){background:#fafafa;}
        .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;border:1px solid #e5e7eb;background:#fff;white-space:nowrap;}
        .badge.ok{color:#065f46;border-color:#bbf7d0;background:#ecfdf5;}
        .badge.pend{color:#92400e;border-color:#fde68a;background:#fffbeb;}
        .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;align-items:stretch;}
        @media(max-width:980px){.stats{grid-template-columns:1fr;}}
        .stat{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:8px;}
        .row{display:grid;grid-template-columns:1fr auto;align-items:center;column-gap:8px;white-space:nowrap;}
        .muted{color:#6b7280;font-size:13px;margin:0;line-height:1;}
        .val{font-weight:700;font-size:15px;text-align:right;margin:0;line-height:1;display:inline-block;}
        .val.saida{color:#b91c1c;}
        .val.positivo{color:#065f46;}
        .val.negativo{color:#b91c1c;}
      `}</style>
    </>
  );
}
