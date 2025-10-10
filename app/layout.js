export const metadata = { title: "Gerenciamento Familiar" };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, Arial, sans-serif", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
