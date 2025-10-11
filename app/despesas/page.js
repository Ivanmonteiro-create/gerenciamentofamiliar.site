"use client";

import { useEffect, useMemo, useState } from "react";
import categorias from "../../data/categorias.json";

// —— helpers ——
const STORAGE_KEY = "gf_transactions_v1";

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
    return n.toFixed(2);
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
  });

  // filtros
  const [fTipo, setFTipo] = useState("todas"); // todas | entrada | saída
  const [fCategoria, setFCategoria] = useState("todas");
  const [fMes, setFMes] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
  });
  const [busca, setBusca] = useState("");

  // carregar do localStorage
  useEffect(() => {
    setTxs(loadTransactions());
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
      criadoEm: new Date().toISOString(),
    };
    setTxs((prev) => [novo, ...prev].sort((a, b) => (a.data < b.data ? 1 : -1)));
    // reset leve mantendo tipo e categoria
    setForm((f) => ({ ...f, descricao: "", valor: "", data: todayISO() }));
  }

  function delTx(id) {
    if (!confirm("Apagar este lançamento?")) return;
    setTxs((prev) => prev.filter((t) => t.id !== id));
  }

  // filtros aplicados
  const txsFiltradas = useMemo(() => {
    return txs.filter((t) => {
      const okTipo = fTipo === "todas" ? true : t.tipo === fTipo;
      const okCat = fCategoria === "todas" ? true : t.categoria === fCategoria;
      const okMes =
        fMes === "tudo"
          ? true
          : t.data.startsWith(fMes); // compara YYYY-MM
      const okBusca =
        !busca
          ? true
          : t.descricao.toLowerCase().includes(busca.toLowerCase()) ||
            t.categoria.toLowerCase().includes(busca.toLowerCase());
      return okTipo && okCat && okMes && okBusca;
    });
  }, [txs, fTipo, fCategoria, fMes, busca]);

  // totais
  const totalEntrada = useMemo(
    () => txsFiltradas.filter(t => t.tipo === "entrada").reduce((s, t) => s + t.valor, 0),
    [txsFiltradas]
  );
  const totalSaida = useMemo(
    () => txsFiltradas.filter(t => t.tipo === "saída").reduce((s, t) => s + t.valor, 0),
    [txsFiltradas]
  );
  const saldo = totalEntrada - totalSaida;

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
            <button className="btn" onClick={addTx}>Adicionar</button>
          </div>
        </div>
      </div>

      {/* —— Filtros + Totais —— */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
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

          <div>
            <label className="lbl">Busca</label>
            <input
              className="inp"
              placeholder="Descrição ou categoria…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <div className="totbox">
            <div><small className="muted">Entradas</small><div><b>{currency(totalEntrada)}</b></div></div>
            <div><small className="muted">Saídas</small><div><b style={{color:"#b91c1c"}}>{currency(totalSaida)}</b></div></div>
            <div><small className="muted">Saldo</small><div><b style={{color: saldo>=0 ? "#065f46" : "#b91c1c"}}>{currency(saldo)}</b></div></div>
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
                <th className="th" style={{ textAlign: "right" }}>Valor</th>
                <th className="th">Tipo</th>
                <th className="th" style={{ textAlign: "center" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {txsFiltradas.map((t) => (
                <tr key={t.id} className="tr">
                  <td className="td">{new Date(t.data + "T00:00:00").toLocaleDateString("pt-PT")}</td>
                  <td className="td">{t.descricao}</td>
                  <td className="td">{t.categoria}</td>
                  <td className="td" style={{ textAlign: "right", color: t.tipo === "entrada" ? "#065f46" : "#b91c1c" }}>
                    {t.tipo === "saída" ? "-" : "+"}{currency(t.valor)}
                  </td>
                  <td className="td">{t.tipo}</td>
                  <td className="td" style={{ textAlign: "center" }}>
                    <button className="btn-sm danger" onClick={() => delTx(t.id)}>Excluir</button>
                  </td>
                </tr>
              ))}
              {txsFiltradas.length === 0 && (
                <tr>
                  <td className="td" colSpan={6} style={{ textAlign: "center", color:"#6b7280" }}>
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* estilos locais para inputs/tabela */}
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
        .totbox { display:flex; gap:18px; align-items:flex-end; }
        .totbox > div { background:#fff; border:1px solid #e5e7eb; border-radius:10px; padding:10px 12px; }
      `}</style>
    </>
  );
}
