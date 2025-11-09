// app/layout.js
import "./globals.css";
import Script from "next/script";

export const metadata = {
  title: "Gerenciamento Financeiro",
  description: "Seu controle financeiro simples e rápido.",
  // se o arquivo estiver em /public/manifest.webmanifest
  manifest: "/manifest.webmanifest",
  themeColor: "#0f172a", // cor da barra (pode ajustar)
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="logo">GF</div>
            <nav className="menu">
              <a href="/dashboard">📊 Dashboard</a>
              <a href="/despesas">💸 Despesas & Receitas</a>
              <a href="/cartoes">💳 Cartões</a>
              <a href="/emprestimos">📑 Empréstimos</a>
              <a href="/investimentos">📈 Investimentos</a>
              <a href="/configuracoes">⚙️ Configurações</a>
            </nav>
          </aside>

          <main className="content">
            {children}
          </main>
        </div>

        {/* --- Botão flutuante de instalação do PWA --- */}
        <button
          id="pwa-install-btn"
          style={{
            position: "fixed",
            right: "18px",
            bottom: "18px",
            padding: "10px 14px",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            background: "#2563eb",
            color: "#fff",
            fontWeight: 600,
            boxShadow: "0 6px 18px rgba(0,0,0,.14)",
            cursor: "pointer",
            display: "none", // começa oculto; o script mostra quando possível
            zIndex: 1000,
          }}
        >
          Instalar app
        </button>

        {/* Registra o Service Worker (se existir) */}
        <Script id="pwa-sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              // Se você estiver usando next-pwa, o SW padrão é /sw.js
              navigator.serviceWorker.register('/sw.js').catch(() => {});
            }
          `}
        </Script>

        {/* Lida com o evento beforeinstallprompt e mostra o botão */}
        <Script id="pwa-install-handler" strategy="afterInteractive">
          {`
            (function(){
              let deferredPrompt = null;
              const btn = document.getElementById('pwa-install-btn');

              window.addEventListener('beforeinstallprompt', (e) => {
                // impede o banner automático
                e.preventDefault();
                deferredPrompt = e;
                if (btn) btn.style.display = 'inline-block';
              });

              if (btn) {
                btn.addEventListener('click', async () => {
                  if (!deferredPrompt) return;
                  btn.disabled = true;
                  try {
                    deferredPrompt.prompt();
                    await deferredPrompt.userChoice;
                  } catch (err) {}
                  deferredPrompt = null;
                  btn.style.display = 'none';
                  btn.disabled = false;
                });
              }

              // Em iOS (Safari), não há beforeinstallprompt — o usuário instala via "Compartilhar > Adicionar à Tela de Início".
              // Mantemos o botão escondido nesses casos.
            })();
          `}
        </Script>
      </body>
    </html>
  );
}
