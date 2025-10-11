"use client";

import { useEffect, useMemo, useState } from "react";
import categorias from "../../data/categorias.json";

// —— helpers ——
const STORAGE_KEY = "gf_transactions_v2"; // v2 por causa do novo campo "status"

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
  // —— estado principal ——
  const [txs, setTxs] = useState([]);
  const [form, setForm] = useState({
    data: todayISO(),
    descricao: "",
    categoria: "",
    tipo: "saída", // "entrada" | "saída"
    valor: "",
    status: "pago", // "pago" | "pendente"
  });

  // estado de edição (linha inline)
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  // filtros
  const [fTipo, setFTipo] = useState("todas"); // todas | entrada | saída
  const [fCategoria, setFCategoria] = useState("todas");
  const [fMes, setFMes] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
  });

  // carregar do localStorage
  useEffect(() => {
    // migrações simples: se vier do v1, adiciona status "pago" por padrão
    const loaded = loadTransactions();
    const withStatus = loaded.map((t) => (t.status ? t : { ...t, status: "pago" }));
    setTxs(withStatus);
  }, []);

  // salvar sempre que mudar
  useEffect(() => {
    saveTransactions(txs);
  }, [txs]);

  // categorias combinadas para o select
  const categoriasSelect = useMemo(() => {
    return [
      ...categorias.entradas,
      ...categorias.saidas_fixas,
      ...categorias.saidas_variaveis,
    ];
  }, []);

  // adicionar transação
  function addTx() {
    const v = parseFloat(String(form.valor).replace(",", "."));
    if (!form.descricao || !form.categoria || !form.data || !form.tipo || isNaN(v) || v <= 0) {
      alert("Preencha: descrição, data, categoria, tipo e um valor maior que 0.");
      return;
    }
    const novo = {
      id: Math.random().toString(36).slice(2),
      data: form.data, // YYYY-MM-DD
      descricao: form.descricao.trim(),
      categoria: form.categoria,
      tipo: form.tipo, // entrada/saída
      valor: v,
      status: form.status, // pago/pendente
      criadoEm: new Date().toISOString(),
    };
    setTxs((prev) => [novo, ...prev].sort((a, b) => (a.data < b.data ? 1 : -1)));
    // reset leve mantendo tipo, categoria e status
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

  // filtros aplicados
  const txsFiltradas = useMemo(() => {
    return txs.filter((t) => {
      const okTipo = fTipo === "todas" ? true : t.tipo === fTipo;
      const okCat = fCategoria === "todas" ? true : t.categoria === fCategoria;
      const okMes = fMes === "tudo" ? true : t.data.startsWith(fMes); // compara YYYY-MM
      return okTipo && okCat && okMes;
    });
  }, [txs, fTipo, fCategoria, fMes]);

  // totais — previsto (todos) x real (somente pagos)
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
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Novo lançamento</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
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
      <div className="card" style={{ marginBottom: 14 }}>
        {/* linha 1: filtros */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
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
            <div style={{ marginTop: 6 }}>
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

        {/* linha 2: totais (previsto x real) */}
        <div className="stats" style={{ marginTop: 12 }}>
          <div className="stat">
            <small className="muted">Entradas (Prev.)</small>
            <div className="stat-value">{currency(totalEntradaPrev)}</div>
            <small className="muted">Entradas (Reais)</small>
            <div className="stat-value positivo">{currency(totalEntradaReal)}</div>
          </div>
          <div className="stat">
            <small className="muted">Saídas (Prev.)</small>
            <div className="stat-value saida">{currency(totalSaidaPrev)}</div>
            <small className="muted">Saídas (Reais)</small>
            <div className="stat-value saida">{currency(totalSaidaReal)}</div>
          </div>
          <div className="stat">
            <small className="muted">Saldo Previsto</small>
            <div className={`stat-value ${saldoPrev >= 0 ? "positivo" : "negativo"}`}>
              {currency(saldoPrev)}
            </div>
            <small className="muted">Saldo Real</small>
            <div className={`stat-value ${saldoReal >= 0 ? "positivo" : "negativo"}`}>
              {currency(saldoReal)}
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
              {txsFiltradas.map((t) => {
                const isEditing = editId === t.id;
                if (isEditing) {
                  return (
                    <tr key={t.id} className="tr">
                      <td className="td">
                        <input
                          className="inp"
                          type="date"
                          value={editForm.data}
                          onChange={(e) => setEditForm({ ...editForm, data: e.target.value })}
                          style={{ minWidth: 130 }}
                        />
                      </td>
                      <td className="td">
                        <input
                          className="inp"
                          value={editForm.descricao}
                          onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })}
                        />
                      </td>
                      <td className="td">
                        <select
                          className="inp"
                          value={editForm.categoria}
                          onChange={(e) => setEditForm({ ...editForm, categoria: e.target.value })}
                        >
                          {categoriasSelect.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td className="td">
                        <select
                          className="inp"
                          value={editForm.tipo}
                          onChange={(e) => setEditForm({ ...editForm, tipo: e.target.value })}
                        >
                          <option value="entrada">Entrada</option>
                          <option value="saída">Saída</option>
                        </select>
                      </td>
                      <td className="td" style={{ textAlign: "right" }}>
                        <input
                          className="inp"
                          type="number"
                          step="0.01"
                          value={editForm.valor}
                          onChange={(e) => setEditForm({ ...editForm, valor: e.target.value })}
                          style={{ textAlign: "right", minWidth: 120 }}
                        />
                      </td>
                      <td className="td">
                        <select
                          className="inp"
                          value={editForm.status}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                        >
                          <option value="pago">Pago</option>
                          <option value="pendente">Pendente</option>
                        </select>
                      </td>
                      <td className="td" style={{ textAlign: "center" }}>
                        <button className="btn-sm" onClick={saveEdit}>Salvar</button>{" "}
                        <button className="btn-sm" onClick={cancelEdit}>Cancelar</button>
                      </td>
                    </tr>
                  );
                }

                return (
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
                );
              })}
              {txsFiltradas.length === 0 && (
                <tr>
                  <td className="td" colSpan={7} style={{ textAlign: "center", color:"#6b7280" }}>
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* estilos locais */}
      <style jsx>{`
        .lbl { display:block; font-size:12px; color:#6b7280; margin-bottom:6px; }
        .inp { width:100%; padding:10px 11px; border:1px solid #e5e7eb; border-radius:8px; background:#fff; }
        .btn { width:100%; padding:11px 12px; border:0; border-radius:8px; background:#0ea5e9; color:#fff; cursor:pointer; }
        .btn:hover { opacity:.9; }
        .btn-sm { padding:6px 10px; border:1px solid #e5e7eb; border-radius:8px; background:#fff; cursor:pointer; }
        .btn-sm:hover { background:#f3f4f6; }
        .btn-sm.danger { border-color:#fecaca; color:#b91c1c; }
        .th, .td { padding:10px 12px; border-bottom:1px solid #f1f5f9; text-align:left; }
        .tr:nth-child(even) { background:#fafafa; }

        /* badges de status */
        .badge {
          display:inline-block;
          padding:4px 8px;
          border-radius:999px;
          font-size:12px;
          border:1px solid #e5e7eb;
          background:#fff;
        }
        .badge.ok { color:#065f46; border-color:#bbf7d0; background:#ecfdf5; }
        .badge.pend { color:#92400e; border-color:#fde68a; background:#fffbeb; }

        /* Totais: grid responsivo, 3 cartões dentro do card */
        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          align-items: stretch;
        }
        @media (max-width: 900px) { .stats { grid-template-columns: 1fr; } }
        .stat {
          background:#fff; border:1px solid #e5e7eb; border-radius:10px; padding:12px;
        }
        .stat-value {
          font-weight:700; font-size:18px; margin-top:4px; text-align:right;
        }
        .stat-value.saida { color:#b91c1c; }
        .stat-value.positivo { color:#065f46; }
        .stat-value.negativo { color:#b91c1c; }
      `}</style>
    </>
  );
}
