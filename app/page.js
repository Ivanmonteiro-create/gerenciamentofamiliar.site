export default function Home() {
  return (
    <div className="card">
      <h2 style={{marginTop:0}}>Gerenciamento Financeiro</h2>
      <p className="muted">Use o menu à esquerda. Abrindo o <b>Dashboard</b>…</p>
      <script
        dangerouslySetInnerHTML={{
          __html: 'setTimeout(()=>{location.href="/dashboard"}, 400);',
        }}
      />
    </div>
  );
}
