// Modo de demonstração pública (ALTA_MODO_DEMONSTRACAO=1).
//
// Feito para um endereço aberto, com contas fictícias compartilhadas entre
// visitantes. Muda só o que um site público de demonstração exige:
//
// - as mensagens (códigos, convites) vão para uma caixa simulada visível no
//   site, porque nenhum destinatário existe de verdade;
// - o segundo fator dos profissionais é dispensado, para quem visita não
//   precisar de um aplicativo autenticador;
// - nada que tire a conta compartilhada de outro visitante é permitido:
//   trocar ou redefinir senha, ligar 2FA, cadastrar passkey, encerrar sessões;
// - o bloqueio progressivo por conta é desligado (um visitante não trava a
//   conta de demonstração dos outros); o limite por IP continua.
//
// Nunca use com dados reais: o modo pressupõe que todo o conteúdo é fictício.

export const modoDemonstracao = () => process.env.ALTA_MODO_DEMONSTRACAO === "1";

export const MENSAGEM_INDISPONIVEL = "Indisponível na demonstração pública: as contas são compartilhadas entre visitantes.";

/** Rotas do Better Auth que mudariam a conta compartilhada. */
export const BLOQUEADAS_NA_DEMONSTRACAO = new Set([
  "/change-password",
  "/request-password-reset",
  "/reset-password",
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/get-totp-uri",
  "/two-factor/generate-backup-codes",
  "/passkey/generate-register-options",
  "/passkey/verify-registration",
  "/passkey/delete-passkey",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
  "/change-email",
  "/delete-user",
]);

export type ContaDemonstracao = { perfil: string; email: string; descricao: string };

/** Contas criadas por `npm run db:seed -- --reset --demo`. */
export const CONTAS_DEMONSTRACAO: ContaDemonstracao[] = [
  { perfil: "Enfermagem", email: "ana.enfermagem@norte.exemplo.test", descricao: "Monta o plano de alta e gera o QR code" },
  { perfil: "Revisor clínico", email: "bruno.revisor@norte.exemplo.test", descricao: "Revisa e publica — nunca o próprio plano" },
  { perfil: "Paciente", email: "maria.paciente@exemplo.test", descricao: "Vê o plano, marca doses, responde ao questionário" },
  { perfil: "Admin institucional", email: "carla.admin@norte.exemplo.test", descricao: "Vínculos da equipe, sem acesso clínico" },
  { perfil: "Auditor", email: "davi.auditor@norte.exemplo.test", descricao: "Trilha de auditoria, com exposição mínima" },
];

/** Senha única das contas de demonstração (pública por definição). */
export const senhaDemonstracao = () => process.env.ALTA_DEMO_SENHA ?? "";
