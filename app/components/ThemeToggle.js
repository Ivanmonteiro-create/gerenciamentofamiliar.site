"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState("light");

  // carrega preferência salva ou preferencia do SO
  useEffect(() => {
    const saved =
      typeof window !== "undefined" && localStorage.getItem("gf-theme");
    const initial =
      saved ||
      (window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("gf-theme", next);
  };

  return (
    <button
      aria-label="Alternar tema claro/escuro"
      onClick={toggleTheme}
      className="theme-toggle"
      title={theme === "dark" ? "Tema escuro ativo — clicar para claro" : "Tema claro ativo — clicar para escuro"}
    >
      {/* Ícone SVG puro: sol para claro, lua para escuro */}
      {theme === "dark" ? (
        // Lua
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"
            fill="currentColor"
          />
        </svg>
      ) : (
        // Sol
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zM1 13h3v-2H1v2zm10 10h2v-3h-2v3zM4.96 19.78l1.41 1.41 1.8-1.79-1.42-1.41-1.79 1.79zM20 11v2h3v-2h-3zm-2.34-7.95l-1.41 1.41 1.79 1.8 1.41-1.42-1.79-1.79zM17.24 19.16l1.8 1.79 1.41-1.41-1.79-1.8-1.42 1.42zM12 6a6 6 0 100 12 6 6 0 000-12zM11 1h2v3h-2V1z"
            fill="currentColor"
          />
        </svg>
      )}
    </button>
  );
}
