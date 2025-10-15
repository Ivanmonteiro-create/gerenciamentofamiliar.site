"use client";

import { useEffect, useState } from "react";
import "./investimentos.css";

const STORAGE_KEY = "gf_investimentos_v1";
const COINGECKO_API = "https://api.coingecko.com/api/v3/simple/price";

export default function InvestimentosPage() {
  const [ativos, setAtivos] = useState([]);
  const [form, setForm] = useState({
    tipo: "cripto",
    simbolo: "",
    nome: "",
    quantidade: "",
    precoMedio: "",
    cor: "#22c55e",
  });
  const [totais, setTotais] = useState({
    valorAtual: 0,
    custoTotal: 0,
    plNaoRealizado: 0,
  });

  // === Carrega investimentos do LocalStorage ===
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setAtivos(JSON.parse(raw));
    } catch {}
  }, []);

  // === Atualiza preços das criptos automaticamente ===
  useEffect(() => {
    const criptos = ativos.filter((a) => a.tipo === "cripto");
    if (criptos.length === 0) return;

    const ids = criptos.map((a) => a.simbolo.toLowerCase()).join(",");
    fetch(`${COINGECKO_API}?ids=${ids}&vs_currencies=eur`)
      .then((r) => r.json())
      .then((data) => {
        const atualizados = ativos.map((a) => {
          if (a.tipo !== "cripto") return a;
          const price =
            data[a.simbolo.toLowerCase()]?.eur || a.precoAtual || 0;
          return { ...a, precoAtual: price };
        });
        setAtivos(atualizados);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(atualizados));
      })
      .catch(() => {});
  }, [ativos.length]);

  // === Calcula totais gerais ===
  useEffect(() => {
    const valorAtual = ativos.reduce(
      (s, a) => s + a.quantidade * (a.precoAtual || a.precoMedio || 0),
      0
    );
    const custoTotal = ativos.reduce(
      (s, a) => s + a.quantidade * (a.precoMedio || 0),
      0
    );
    const plNaoRealizado = valorAtual - custoTotal;
    setTotais({ valorAtual, custoTotal, plNaoRealizado });
  }, [ativos]);

  // === Adicionar ativo ===
  function addAtivo(e) {
    e.preventDefault();
    const novo = {
      id: Math.random().toString(36).slice(2),
      tipo: form.tipo,
      simbolo: form.simbolo.trim(),
      nome: form.nome.trim(),
      quantidade: Number(form.quantidade || 0),
      precoMedio: Number(form.precoMedio || 0),
      precoAtual: 0,
      cor: form.cor || "#22c55e",
    };
    const prox = [...ativos, novo];
    setAtivos(prox);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prox));
    setForm({
      tipo: "cripto",
      simbolo: "",
      nome: "",
      quantidade: "",
      precoMedio: "",
      cor: "#22c55e",
    });
  }

  // === Excluir ativo ===
  function deleteAtivo(id) {
    if (!confirm("Excluir este ativo?")) return;
    const prox = ativos.filter((a) => a.id !== id);
    setAtivos(prox);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prox));
  }

  // === Formatadores ===
  const fmt = (n) =>
    Number(n || 0).toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    });

  // === Renderização ===
  return (
    <div id="invest">
      <h1 className="page-title">Investimentos</h1>

      <div className="invest-summary">
        <div>
          <div className="label">Valor atual</div>
          <div className="value">{fmt(totais.valorAtual)}</div>
        </div>
        <div>
          <div className="label">Custo total</div>
          <div className="value">{fmt(totais.custoTotal)}</div>
        </div>
        <div>
          <div className="label">P/L não realizado</div>
          <div
            className={`value ${
              totais.plNaoRealizado >= 0 ? "positivo" : "negativo"
            }`}
          >
            {fmt(totais.plNaoRealizado)} (
            {((totais.plNaoRealizado / (totais.custoTotal || 1)) * 100).toFixed(
              2
            )}
            %)
          </div>
        </div>
      </div>

      <div className="invest-grid">
        <div className="carteira">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Ativo</th>
                <th>Qtd</th>
                <th>Preço Méd.</th>
                <th>Preço Atual</th>
                <th>Valor Atual</th>
                <th>P/L</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {ativos.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", opacity: 0.6 }}>
                    Nenhum investimento adicionado.
                  </td>
                </tr>
              ) : (
                ativos.map((a) => {
                  const valorAtual =
                    a.quantidade * (a.precoAtual || a.precoMedio || 0);
                  const custo = a.quantidade * (a.precoMedio || 0);
                  const pl = valorAtual - custo;
                  const plPct = (pl / (custo || 1)) * 100;
                  return (
                    <tr key={a.id}>
                      <td>
                        <span
                          className={`dot ${a.tipo}`}
                          style={{ background: a.cor }}
                        ></span>{" "}
                        {a.tipo}
                      </td>
                      <td>{a.simbolo.toUpperCase()}</td>
                      <td>{a.quantidade}</td>
                      <td>{fmt(a.precoMedio)}</td>
                      <td>{fmt(a.precoAtual || a.precoMedio)}</td>
                      <td>{fmt(valorAtual)}</td>
                      <td
                        style={{
                          color: pl >= 0 ? "#15803d" : "#b91c1c",
                          fontWeight: 600,
                        }}
                      >
                        {fmt(pl)} ({plPct.toFixed(2)}%)
                      </td>
                      <td>
                        <button
                          className="btn-delete"
                          onClick={() => deleteAtivo(a.id)}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <form className="novo-ativo" onSubmit={addAtivo}>
          <div className="titulo-form">Adicionar ativo</div>

          <div className="radio-group">
            <label>
              <input
                type="radio"
                name="tipo"
                value="cripto"
                checked={form.tipo === "cripto"}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              />
              Cripto
            </label>
            <label>
              <input
                type="radio"
                name="tipo"
                value="acao"
                checked={form.tipo === "acao"}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              />
              Ação
            </label>
            <label>
              <input
                type="radio"
                name="tipo"
                value="outro"
                checked={form.tipo === "outro"}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              />
              Outro
            </label>
          </div>

          <input
            placeholder="Símbolo (ex: BTC, AAPL)"
            value={form.simbolo}
            onChange={(e) => setForm({ ...form, simbolo: e.target.value })}
            required
          />
          <input
            placeholder="Nome (opcional)"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
          />
          <input
            placeholder="Quantidade"
            type="number"
            value={form.quantidade}
            onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
            required
          />
          <input
            placeholder="Preço médio (€)"
            type="number"
            value={form.precoMedio}
            onChange={(e) => setForm({ ...form, precoMedio: e.target.value })}
            required
          />
          <div className="cor-box">
            <span>Cor:</span>
            <input
              type="color"
              value={form.cor}
              onChange={(e) => setForm({ ...form, cor: e.target.value })}
            />
          </div>

          <button type="submit" className="btn-save">
            Salvar
          </button>
        </form>
      </div>
    </div>
  );
}
