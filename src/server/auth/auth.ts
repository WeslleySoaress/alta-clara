import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { and, eq } from "drizzle-orm";
import { avaliarSessao } from "./politica-sessao";
import { db } from "../db/cliente";
import * as schema from "../db/schema";
import { enviarMensagem } from "../mensagens";
import { bloqueioAtivo, limparFalhas, registrarFalha } from "./bloqueio-conta";
import { descreverAparelho } from "./aparelho";
import { BLOQUEADAS_NA_DEMONSTRACAO, MENSAGEM_INDISPONIVEL, modoDemonstracao } from "../demonstracao";
import { hashSenha, problemaNaSenhaCompleto, SENHA_MAX, SENHA_MIN, verificarSenha } from "./senha";

const urlBase = process.env.BETTER_AUTH_URL ?? "http://localhost:3100";
const producao = process.env.NODE_ENV === "production";

// Operações que cadastram ou removem autenticadores exigem login recente,
// para que uma sessão esquecida aberta não sirva de atalho para contornar o MFA.
const EXIGEM_LOGIN_RECENTE = new Set([
  "/passkey/generate-register-options",
  "/passkey/delete-passkey",
  "/two-factor/generate-backup-codes",
  "/two-factor/disable",
  "/two-factor/get-totp-uri",
]);
const LOGIN_RECENTE_MS = 10 * 60 * 1000;

// Rotas que não dependem de sessão existente (a política de sessão não se aplica).
const ROTAS_SEM_SESSAO = new Set([
  "/sign-in/email",
  "/sign-in/passkey",
  "/passkey/generate-authenticate-options",
  "/passkey/verify-authentication",
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
  "/request-password-reset",
  "/reset-password",
  "/sign-out",
]);

export const auth = betterAuth({
  appName: "Alta Clara",
  baseURL: urlBase,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [urlBase],
  // O nome vem do provisionamento/ativação. Trocar o próprio nome falsificaria a
  // autoria exibida no histórico e na auditoria.
  disabledPaths: ["/update-user"],
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: false }),
  // Nenhum dado de uso é enviado ao fornecedor da biblioteca.
  telemetry: { enabled: false },

  emailAndPassword: {
    enabled: true,
    // Contas só são criadas por convite (paciente/cuidador) ou provisionamento
    // institucional (profissionais). Não existe cadastro aberto.
    disableSignUp: true,
    minPasswordLength: SENHA_MIN,
    maxPasswordLength: SENHA_MAX,
    password: { hash: hashSenha, verify: verificarSenha },
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 30 * 60,
    async sendResetPassword({ user, url }) {
      void enviarMensagem({
        para: user.email,
        assunto: "Redefinição de senha do Alta Clara",
        corpo: `Recebemos um pedido para redefinir sua senha. O link vale por 30 minutos:\n\n${url}\n\nSe não foi você, ignore esta mensagem. Sua senha atual continua valendo.`,
      }).catch(() => {});
    },
    async onPasswordReset({ user }) {
      await enviarMensagem({
        para: user.email,
        assunto: "Sua senha do Alta Clara foi alterada",
        corpo: "Sua senha foi alterada e as sessões abertas foram encerradas. Se não foi você, procure a unidade de saúde.",
      });
    },
  },

  session: {
    // Duração absoluta máxima de qualquer sessão. Limites mais curtos por
    // perfil (ex.: 15 min de inatividade e 8 h para profissionais) são
    // aplicados em src/server/auth/sessao.ts.
    expiresIn: 7 * 24 * 60 * 60,
    disableSessionRefresh: true,
    freshAge: 10 * 60,
    additionalFields: {
      ultimaAtividade: { type: "date", required: false, input: false },
    },
  },

  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/two-factor/verify-totp": { window: 60, max: 6 },
      "/two-factor/verify-backup-code": { window: 60, max: 6 },
      "/request-password-reset": { window: 300, max: 3 },
    },
  },

  advanced: {
    useSecureCookies: producao,
    cookiePrefix: "alta",
    // Em produção, informe os IPs do proxy reverso (que sobrescreve
    // X-Forwarded-For). Sem isso, o limite por IP pode ser burlado com um
    // cabeçalho forjado — o limite por conta (bloqueio-conta.ts) continua valendo.
    ipAddress: process.env.ALTA_PROXIES_CONFIAVEIS
      ? { trustedProxies: process.env.ALTA_PROXIES_CONFIAVEIS.split(",").map((p) => p.trim()) }
      : undefined,
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const corpo = (ctx.body ?? {}) as { email?: unknown; newPassword?: unknown; trustDevice?: unknown };

      // Demonstração pública: nada que tire a conta compartilhada de outro visitante.
      if (modoDemonstracao() && BLOQUEADAS_NA_DEMONSTRACAO.has(ctx.path)) {
        throw new APIError("FORBIDDEN", { message: MENSAGEM_INDISPONIVEL });
      }

      // "Confiar neste aparelho" pularia o segundo fator por 30 dias — inadequado
      // em computadores compartilhados de hospital.
      if (ctx.path.startsWith("/two-factor/verify") && corpo.trustDevice) {
        throw new APIError("BAD_REQUEST", { message: "Opção indisponível." });
      }

      // A mesma política de inatividade/duração do app vale nas rotas /api/auth/*.
      if (!ROTAS_SEM_SESSAO.has(ctx.path)) {
        const atual = await getSessionFromCtx(ctx).catch(() => null);
        if (atual) {
          const vinculos = await db.select({ id: schema.vinculo.id }).from(schema.vinculo).where(and(eq(schema.vinculo.userId, atual.user.id), eq(schema.vinculo.ativo, true))).limit(1);
          const ultima = (atual.session as { ultimaAtividade?: Date | null }).ultimaAtividade ?? null;
          const r = avaliarSessao({
            criadaEm: new Date(atual.session.createdAt),
            ultimaAtividade: ultima ? new Date(ultima) : null,
            profissional: vinculos.length > 0,
            agora: Date.now(),
          });
          if (r.motivo) {
            await db.delete(schema.session).where(eq(schema.session.id, atual.session.id));
            throw new APIError("UNAUTHORIZED", { message: "Sessão encerrada. Entre novamente." });
          }
        }
      }

      // Limitação progressiva por conta, além do limite por IP.
      if (ctx.path === "/sign-in/email" && typeof corpo.email === "string" && !modoDemonstracao()) {
        if (await bloqueioAtivo(corpo.email)) {
          // Mesma resposta exista ou não a conta.
          throw new APIError("TOO_MANY_REQUESTS", { message: "Muitas tentativas. Aguarde alguns minutos e tente de novo." });
        }
      }

      // Senhas comuns também são recusadas na troca e na redefinição.
      if ((ctx.path === "/change-password" || ctx.path === "/reset-password") && typeof corpo.newPassword === "string") {
        const atual = ctx.path === "/change-password" ? await getSessionFromCtx(ctx).catch(() => null) : null;
        const problema = await problemaNaSenhaCompleto(corpo.newPassword, atual?.user?.email);
        if (problema) throw new APIError("BAD_REQUEST", { message: problema });
      }

      if (!EXIGEM_LOGIN_RECENTE.has(ctx.path)) return;
      const sessao = await getSessionFromCtx(ctx);
      if (!sessao || Date.now() - new Date(sessao.session.createdAt).getTime() > LOGIN_RECENTE_MS) {
        throw new APIError("FORBIDDEN", { message: "Por segurança, entre novamente antes de alterar seus métodos de acesso." });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/change-password" && !(ctx.context.returned instanceof APIError)) {
        const sessao = ctx.context.session ?? (await getSessionFromCtx(ctx).catch(() => null));
        if (sessao?.user?.email) {
          void enviarMensagem({
            para: sessao.user.email,
            assunto: "Sua senha do Alta Clara foi alterada",
            corpo: "Sua senha foi alterada. Se não foi você, procure a unidade de saúde imediatamente.",
          }).catch(() => {});
        }
        return;
      }
      if (ctx.path !== "/sign-in/email" || modoDemonstracao()) return;
      const email = (ctx.body as { email?: unknown } | undefined)?.email;
      if (typeof email !== "string") return;
      const r = ctx.context.returned;
      const falhou = r instanceof APIError || (r instanceof Response && r.status >= 400);
      if (falhou) {
        // 429 do próprio bloqueio não conta como nova falha.
        if (!(r instanceof APIError && r.status === "TOO_MANY_REQUESTS")) await registrarFalha(email);
      } else {
        await limparFalhas(email);
      }
    }),
  },

  databaseHooks: {
    session: {
      create: {
        // Aviso de novo acesso: quem não reconhece o acesso pode agir rápido.
        async after(sessao) {
          // Na demonstração as contas são compartilhadas: o aviso só faria ruído.
          if (modoDemonstracao()) return;
          const [u] = await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, sessao.userId));
          if (!u) return;
          const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date());
          await enviarMensagem({
            para: u.email,
            assunto: "Novo acesso à sua conta do Alta Clara",
            corpo: `Houve um novo acesso à sua conta em ${quando} (${descreverAparelho(sessao.userAgent)}).\n\nSe não foi você, altere sua senha e encerre as outras sessões em Segurança da conta.`,
          }).catch(() => {});
        },
      },
    },
  },

  plugins: [
    twoFactor({
      issuer: "Alta Clara",
      // Códigos de recuperação de uso único, cifrados com o segredo do servidor.
      backupCodeOptions: { amount: 10, storeBackupCodes: "encrypted" },
    }),
    passkey({
      rpID: new URL(urlBase).hostname,
      rpName: "Alta Clara",
      origin: urlBase,
      // Verificação do usuário no autenticador (biometria/PIN no próprio aparelho).
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      registration: {
        async afterVerification({ user: dono }) {
          const [u] = await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, dono.id));
          const email = u?.email;
          if (email) {
            await enviarMensagem({
              para: email,
              assunto: "Nova passkey cadastrada no Alta Clara",
              corpo: "Uma nova passkey foi cadastrada na sua conta. Se não foi você, procure a unidade de saúde.",
            });
          }
        },
      },
    }),
    nextCookies(),
  ],
});

export type Auth = typeof auth;
