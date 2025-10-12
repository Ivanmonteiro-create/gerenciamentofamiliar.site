"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState("light"); // 'light' | 'dark'

  // carrega tema salvo
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("gf-theme") : null;
    const next = saved === "dark" ? "dark" : "light";
    setTheme(next);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = next; // <html data-theme="...">
    }
  }, []);

  // aplica e salva
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = next;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("gf-theme", next);
    }
  };

  // ícones SVG (sem libs)
  const Sun = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 2v2m0 16v2M4 12H2m20 0h-2M5.64 5.64l1.41 1.41M16.95 16.95l1.41 1.41M5.64 18.36l1.41-1.41M16.95 7.05l1.41-1.41"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
  const Moon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
            stroke="currentColor" strokeWidth="2" fill="none"/>
    </svg>
  );

  return (
    <div className="theme-toggle" role="group" aria-label="Alternar tema">
      <button
        className={`theme-toggle__btn ${theme === "light" ? "is-active" : ""}`}
        onClick={toggle}
        title={theme === "light" ? "Tema claro (clique para escuro)" : "Tema claro"}
        aria-pressed={theme === "light"}
      >
        {Sun}
      </button>
      <button
        className={`theme-toggle__btn ${theme === "dark" ? "is-active" : ""}`}
        onClick={toggle}
        title={theme === "dark" ? "Tema escuro (clique para claro)" : "Tema escuro"}
        aria-pressed={theme === "dark"}
      >
        {Moon}
      </button>
    </div>
  );
}
