import { db } from "./db/cliente";
import { mensagemDev } from "./db/schema";
import { modoDemonstracao } from "./demonstracao";

/**
 * Envio de mensagens ao paciente/cuidador/profissional.
 *
 * ADAPTADOR LOCAL: grava em `mensagem_dev` para visualização em /dev/mensagens.
 * Nenhuma mensagem sai da máquina. Em produção, substituir por um provedor de
 * e-mail/SMS avaliado (retenção, subprocessadores, região).
 *
 * Na demonstração pública (ALTA_MODO_DEMONSTRACAO=1) a mesma caixa é usada:
 * todo destinatário é fictício e as mensagens aparecem em /dev/mensagens.
 *
 * Regra de conteúdo: nunca incluir nome de medicamento, diagnóstico ou
 * procedimento — a mensagem pode aparecer na tela bloqueada.
 */
export async function enviarMensagem(m: { para: string; assunto: string; corpo: string }) {
  if (process.env.NODE_ENV === "production" && process.env.ALTA_PERMITIR_CAIXA_DEV !== "1" && !modoDemonstracao()) {
    throw new Error("Nenhum provedor de mensagens configurado para produção.");
  }
  await db.insert(mensagemDev).values(m);
}
