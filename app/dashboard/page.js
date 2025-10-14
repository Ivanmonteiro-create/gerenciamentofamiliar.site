"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

// Importa componentes de gráficos (carregamento dinâmico para evitar erro no SSR)
const PieChartComponent = dynamic(() => import("@/components/PieChartComponent"), { ssr: false });
const BarChartComponent = dynamic(() => import("@/components/BarChartComponent"), { ssr: false });

export default function Dashboard() {
  // Estado para armazenar lançamentos e totais
  const [entries, setEntries] = useState([]);
  const [totalEntradas, setTotalEntradas] = useState(0);
  const [totalSaidas, setTotalSaidas] = useState(0);
  const [saldo, setSaldo] = useState(0);
  const [month, setMonth] = useState("");
  const [chartData, setChartData] = useState({});

  // Carrega dados do localStorage
  useEffect(() => {
    const storedEntries = JSON.parse(localStorage.getItem("entries") || "[]");
    setEntries(storedEntries);
  }, []);

  // Calcula totais
  useEffect(() => {
    const entradas = entries.filter(e => e.type === "entrada").reduce((acc, e) => acc + e.value, 0);
    const saidas = entries.filter(e => e.type === "saida").reduce((acc, e) => acc + e.value, 0);
    const saldoTotal = entradas - saidas;
    setTotalEntradas(entradas);
    setTotalSaidas(saidas);
    setSaldo(saldoTotal);
  }, [entries]);

  // Agrupa despesas por categoria para o gráfico
  useEffect(() => {
    const despesas = entries.filter(e => e.type === "saida");
    const categorias = {};
    despesas.forEach(e => {
      categorias[e.category] = (categorias[e.category] || 0) + e.value;
    });
    setChartData(categorias);
  }, [entries]);

  // Define o mês atual
  useEffect(() => {
    const dataAtual = new Date();
    const mes = dataAtual.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
    setMonth(mes.charAt(0).toUpperCase() + mes.slice(1));
  }, []);

  return (
    <div className="dashboard-container" style={{ padding: "1.5rem" }}>
      {/* Cabeçalho simples */}
      <div
        className="titlebar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
        }}
      >
        <h1 className="page-title" style={{ margin: 0 }}>Dashboard</h1>
      </div>

      {/* Totais */}
      <div
        className="totals"
        style={{
          display: "flex",
          gap: "1.5rem",
          flexWrap: "wrap",
          marginBottom: "2rem",
        }}
      >
        <div className="card" style={{ flex: "1", minWidth: "220px" }}>
          <h3>Entradas</h3>
          <p style={{ color: "limegreen", fontWeight: "bold" }}>{totalEntradas.toFixed(2)} €</p>
        </div>
        <div className="card" style={{ flex: "1", minWidth: "220px" }}>
          <h3>Saídas</h3>
          <p style={{ color: "red", fontWeight: "bold" }}>{totalSaidas.toFixed(2)} €</p>
        </div>
        <div className="card" style={{ flex: "1", minWidth: "220px" }}>
          <h3>Saldo</h3>
          <p style={{ color: saldo >= 0 ? "limegreen" : "red", fontWeight: "bold" }}>
            {saldo.toFixed(2)} €
          </p>
        </div>
      </div>

      {/* Gráficos */}
      <div
        className="charts"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.5rem",
        }}
      >
        <div className="chart-card">
          <h3>Despesas por categoria ({month})</h3>
          <PieChartComponent data={chartData} />
        </div>
        <div className="chart-card">
          <h3>Evolução (últimos 6 meses)</h3>
          <BarChartComponent entries={entries} />
        </div>
      </div>
    </div>
  );
}
