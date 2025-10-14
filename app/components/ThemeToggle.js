"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState("light");

  // Inicializa com preferencia salva ou do sistema
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

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("gf-theme", next);
  };

  return (
    <button
      aria-label="Alternar tema claro/escuro"
      onClick={toggle}
      className="theme-toggle"
      title={theme === "dark" ? "Tema escuro — clique para claro" : "Tema claro — clique para escuro"}
    >
      {theme === "dark" ? "🌙" : "☀️"}
    </button>
  );
}
