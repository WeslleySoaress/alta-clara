# Arquitetura e modelo de dados

Monólito modular (sem microsserviços): uma aplicação Next.js e um processador de lembretes, compartilhando o domínio.

```
Navegador ──HTTPS──▶ src/proxy.ts (CSP com nonce, no-store em rotas sensíveis)
                        │
          ┌─────────────┴──────────────────────────────────────────────┐
          │ Interface: src/app (páginas, Server Actions, Route Handlers)
          │   └─ revalida sessão e entrada (Zod); só chama o domínio
          │ Sessão: src/server/auth/sessao.ts + politica-sessao.ts (pura)
          │ Identidade: src/server/auth (Better Auth: senha, TOTP, passkey)
          │ Autorização: src/server/authz (ator do servidor + matriz pura)
          │ Domínio: src/server/dominio
          │   planos · convites · cuidadores · paciente · entendimento
          │   diferencas · pendencias · lembretes · instituicao · conteudo
          │ Integrações (adaptadores): src/server/integracoes
          │   fhir.ts (exportação R4 sandbox) · ia.ts (Claude, opcional)
          │   mensagens.ts (adaptador local de e-mail/SMS)
          │ Persistência: src/server/db (Drizzle, usuário alta_app)
          └─────────────┬──────────────────────────────────────────────┘
                        ▼
              PostgreSQL 18 — papéis alta_owner (DDL) e alta_app (sem DDL)
                        ▲
   scripts/lembretes.ts (processo separado, sem rota HTTP) ┘
```

## Tabelas

Migrações em [`drizzle/`](../drizzle/), esquema em [`src/server/db/schema.ts`](../src/server/db/schema.ts). Tabelas de identidade geradas pelo CLI oficial do Better Auth.

| Tabela | Papel | Restrições importantes |
|---|---|---|
| `instituicao` | Organização (tenant) | — |
| `user`, `session`, `account`, `two_factor`, `passkey`, `verification`, `rate_limit` | Identidade (Better Auth) | `session.ultima_atividade` para inatividade |
| `vinculo` | Papel do profissional por instituição | único (usuário, instituição, papel); `ativo` |
| `paciente`, `atendimento`, `equipe_atendimento` | Pessoa atendida, episódio, vínculo assistencial | único (instituição, prontuário) |
| `modelo_protocolo` | Modelo editável (`sintetico = true` na demo) | — |
| `plano` | **Uma linha por versão**; conteúdo JSONB validado por Zod | único (atendimento, versão); **índices parciais**: 1 publicado e 1 em edição por atendimento; `revisao` (concorrência otimista) |
| `convite` | Ativação de paciente **ou cuidador** (escopo, validade, apelido) | `token_hash`/`sessao_ativacao_hash` únicos; só hashes |
| `autorizacao_cuidador` | Escopo, validade, autoria, revogação | 1 autorização ativa por (paciente, cuidador) |
| `registro_dose` | O que foi **relatado**, com autor | único (plano, item, data, horário) → idempotente |
| `confirmacao_entendimento` | Respostas corrigidas no servidor | — |
| `pendencia` | Tarefa operacional para a equipe | `chave` única entre abertas → sem duplicar |
| `lembrete` | Agendado no servidor (UTC calculado do fuso do plano) | único (plano, usuário, item, instante) → idempotente |
| `preferencia_lembrete` | Opt-in do próprio usuário | — |
| `auditoria` | Quem, o quê, quando, onde, resultado — sem conteúdo clínico | `alta_app` só tem INSERT e SELECT |
| `mensagem_dev` | Adaptador local de mensagens (desenvolvimento) | indisponível em produção |

## Processos

- **Aplicação web** (`next start`): páginas e ações; nunca dispara envios em lote.
- **Processador de lembretes** (`npm run lembretes`): a cada 60 s renova a janela de 7 dias e envia os vencidos com `FOR UPDATE SKIP LOCKED` (vários processadores podem rodar sem duplicar envio). Não há rota HTTP que o acione.
- **Backup** (`scripts/backup.ts`): `COPY` binário em snapshot `REPEATABLE READ`, AES-256-GCM por arquivo, manifesto com SHA-256; restauração em banco separado com conferência.

**Row Level Security:** não adotada. A autorização está na aplicação e é testada; RLS fica como camada adicional planejada.
