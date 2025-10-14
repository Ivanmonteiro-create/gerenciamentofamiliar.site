"use client";

import { useEffect, useState } from "react";

/** Botão mínimo: só ícone. 🌞 claro | 🌙 escuro */
export default function ThemeToggle() {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("gf-theme") : null;
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
      return;
    }
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const initial = prefersDark ? "dark" : "light";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("gf-theme", next); } catch {}
  };

  const isLight = theme === "light";

  const Sun = (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" fill="none"/>
      <path stroke="currentColor" strokeWidth="1.8" d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
    </svg>
  );
  const Moon = (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" stroke="currentColor" strokeWidth="1.8" fill="none"/>
    </svg>
  );

  return (
    <button
      type="button"
      onClick={toggle}
      className="theme-fab"
      aria-label={isLight ? "Ativar modo escuro" : "Ativar modo claro"}
      title={isLight ? "Escuro" : "Claro"}
    >
      {isLight ? Moon : Sun}
    </button>
  );
}
