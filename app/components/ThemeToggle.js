"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "gf_theme"; // "neutral" | "dark"

export default function ThemeToggle() {
  const [theme, setTheme] = useState("neutral");

  // carrega preferência e aplica no body
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(THEME_KEY) : null;
    const initial = saved === "dark" ? "dark" : "neutral";
    setTheme(initial);
    if (initial === "dark") document.body.classList.add("theme-dark");
    else document.body.classList.remove("theme-dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "neutral" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    if (next === "dark") document.body.classList.add("theme-dark");
    else document.body.classList.remove("theme-dark");
  }

  return (
    <button
      onClick={toggle}
      aria-label="Alternar tema"
      title={theme === "dark" ? "Tema escuro ativo — clicar para neutro" : "Tema neutro ativo — clicar para escuro"}
      style={{
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: "#fff",
        fontWeight: 700,
        cursor: "pointer",
        boxShadow: "0 1px 2px rgba(0,0,0,.05)",
        whiteSpace: "nowrap",
      }}
    >
      {theme === "dark" ? "🌞 Claro" : "🌙 Escuro"}
    </button>
  );
}
