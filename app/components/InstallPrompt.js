"use client";
import { useEffect, useState } from "react";

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferred(e); // guarda o evento para disparar depois
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!deferred) return null;

  const handleInstall = async () => {
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // console.log("User choice:", outcome);
    setDeferred(null);
  };

  return (
    <button
      onClick={handleInstall}
      style={{
        marginLeft: 8,
        height: 32,
        padding: "0 10px",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: "#f3f4f6",
        cursor: "pointer",
        fontSize: 13,
      }}
      title="Instalar como aplicativo"
    >
      📥 Instalar app
    </button>
  );
}
