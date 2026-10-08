// Processador de lembretes. Roda fora do servidor web (não há rota HTTP que o
// dispare), com o mesmo usuário de banco restrito da aplicação.
//
//   npm run lembretes          laço contínuo (a cada 60 s)
//   npm run lembretes -- --uma-vez
import { carregarAmbiente } from "./ambiente";

// Processo da aplicação: só o .env.local (sem segredos de operação).
carregarAmbiente({ operacao: false });

async function main() {
  const { processarLembretes, renovarAgendas } = await import("../src/server/dominio/lembretes");
  const { pool } = await import("../src/server/db/cliente");

  let rodando = false;
  async function ciclo() {
    // Ciclos nunca se sobrepõem, mesmo se um envio demorar mais que o intervalo.
    if (rodando) return;
    rodando = true;
    try {
      await cicloSeguro();
    } catch (e) {
      console.error("ciclo falhou:", e instanceof Error ? e.name : e);
    } finally {
      rodando = false;
    }
  }

  async function cicloSeguro() {
    const criados = await renovarAgendas();
    const r = await processarLembretes();
    // Log operacional sem dado clínico nem destinatário.
    console.log(`${new Date().toISOString()} agendados=${criados} enviados=${r.enviados} cancelados=${r.cancelados} falhas=${r.falhas}`);
  }

  if (process.argv.includes("--uma-vez")) {
    await ciclo();
    await pool.end();
    return;
  }
  await ciclo();
  setInterval(() => void ciclo(), 60_000);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
