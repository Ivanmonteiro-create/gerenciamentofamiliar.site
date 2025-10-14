"use client";

import "./globals.css";
import ThemeToggle from "../components/ThemeToggle";

export default function RootLayout({ children }) {
  return (
    <html lang="pt">
      <body>
        <div className="layout-container">
          {/* Cabeçalho fixo com botão de tema */}
          <header
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              height: "48px",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              padding: "0 1.2rem",
              background: "transparent",
              zIndex: 50,
            }}
          >
            <ThemeToggle />
          </header>

          {/* Conteúdo principal */}
          <main
            style={{
              paddingTop: "56px", // espaçamento para não sobrepor o botão
              minHeight: "100vh",
              width: "100%",
              overflowX: "hidden",
            }}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
