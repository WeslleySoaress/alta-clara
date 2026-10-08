# Modelo de ameaças e controles

Escopo: aplicação Alta Clara e seu banco, no ambiente local de desenvolvimento. **Nenhuma afirmação de conformidade** (ASVS, LGPD, HIPAA) é feita. Referência de trabalho: OWASP ASVS 5.0.0, nível 2.

## Ativos e atores

- **Ativos:** planos de alta (dados de saúde), identidade e autenticadores, convites, registros relatados, trilha de auditoria, segredos (`BETTER_AUTH_SECRET`, senhas do banco).
- **Atores de ameaça:** pessoa de fora; paciente curioso sobre outro paciente; cuidador revogado; profissional de outra instituição; profissional com permissão menor que a ação (ex.: admin querendo conteúdo clínico); quem encontra um QR impresso; quem acessa um computador compartilhado do hospital.

## Ameaças, controles e verificação

| Risco | Controle implementado | Como foi verificado | Situação / risco residual |
|---|---|---|---|
| **IDOR/BOLA** (ler plano de outro paciente) | Autorização por objeto em cada serviço; 404 igual para inexistente e negado; negações auditadas | Testes 2, 3 e 4; DAST com sessão real de cuidadora revogada (404) | ✅ |
| **Escalada de privilégio** | Papéis só por `vinculo` no banco; sem cadastro aberto; admin/auditor sem acesso clínico; autor não aprova | `tests/politicas.test.ts`, teste 3, testes de vínculo (admin não altera a si nem outra instituição) | ✅ |
| **Vazamento entre instituições** | Comparação de instituição em todas as regras profissionais; modelo só da própria instituição | Teste 3 | ✅ Sem RLS (camada adicional pendente) |
| **SQL injection** | Drizzle com parâmetros; `sql\`\`` só com valores interpolados como parâmetro; ids validados (UUID) antes do banco; usuário `alta_app` sem DDL | Teste 7 | ✅ |
| **XSS** | React escapa texto; nenhum HTML vindo do usuário é renderizado; o único `dangerouslySetInnerHTML` é SVG gerado pela biblioteca de QR; CSP com nonce e `strict-dynamic` | Teste 8 (render com `<script>`), produção sem erros de CSP | ✅ Em dev a CSP permite `unsafe-eval` (exigência do React em dev) |
| **CSRF** | Server Actions com verificação de origem do Next; Route Handler de ativação exige `Origin` igual e `application/json`; endpoints do Better Auth com `trustedOrigins`; GET não altera estado | DAST em produção: Origin falso → 403; formulário simples → 403 | ✅ |
| **Força bruta / credential stuffing** | Rate limit no banco (login 10/min, TOTP 6/min, reset 3/5 min); código de ativação: 5 tentativas; TOTP com bloqueio da biblioteca; MFA obrigatório para profissionais | Teste de limite do código; DAST: login bloqueado (429) na 8ª tentativa | ✅ Bloqueio progressivo por conta (nunca permanente) + limite por IP com proxies confiáveis configuráveis + teto de Argon2 simultâneos |
| **Enumeração de contas** | Mesma resposta no login e na recuperação | Teste 6 | ✅ |
| **Sequestro/fixação de sessão** | Cookie HttpOnly, SameSite, Secure em produção; novo id a cada login; sessão no servidor; política por perfil; revogação no servidor | Logout, desligamento e política de sessão (função pura) testados; DAST: cookie `__Secure-`, HttpOnly, Secure, SameSite=Lax | ✅ Aviso 2 min antes de expirar; política também aplicada nas rotas /api/auth/*; lista de aparelhos com encerramento individual; aviso de novo acesso |
| **Contornar MFA** (recuperação, novo autenticador) | Reset não desliga TOTP; cadastrar passkey/gerar códigos/desligar 2FA exige login recente; aviso por mensagem | TOTP no E2E; passkey com autenticador WebAuthn virtual; 403 para sessão antiga | ⚠️ Passkey não testada em aparelho físico · ✅ trustDevice recusado; semente TOTP exige login recente |
| **QR code vazado** | Só inicia ativação; código no canal validado; token 256 bits em hash; fragmento (não vai ao servidor); expira em 72 h; novo QR revoga o anterior; consumo atômico | Teste 5 e E2E (token fora de URLs e do log) | ✅ |
| **Vazamento por logs** | Auditoria só com metadados; mensagens sem nome de remédio; log de Server Functions desligado; reset de senha fora do log de requisições | Teste 13 e E2E | ✅ Em produção, configurar o proxy reverso para não registrar corpo |
| **Vazamento por cache** | `no-store` nas rotas sensíveis, inclusive nos pedidos de prefetch do `next/link`; páginas dinâmicas | DAST no build de produção: página e prefetch de `/paciente` com `no-store` | ✅ |
| **Senhas fracas longas** | Mínimo 15; recusa repetição, sequências de teclado/números, pouca variedade, frases só com palavras óbvias (inclusive com troca de símbolos, “p@ssw0rd”) e a parte local do e-mail; consulta opcional ao Pwned Passwords por k-anonimato | `tests/etapa4.test.ts` (fixtures e serviço simulado) | ⚠️ Consulta real ao Pwned Passwords desligada por padrão e não executada |
| **Segredos de operação no processo web** | `.env.local` (app) separado de `.env.operacao.local` (dono do esquema, superusuário, chave de backup); o app recusa subir em produção se receber esses valores ou se conectar como `alta_owner`/`postgres` | E2E e build de produção sem aviso; revisão de código | ✅ Em produção, usar um cofre de segredos por serviço |
| **Alteração da auditoria** | `alta_app` sem UPDATE/DELETE/TRUNCATE em `auditoria` | Teste (erro 42501) | ⚠️ O dono do esquema ainda pode alterar: não chamamos o log de imutável |
| **Clickjacking** | `frame-ancestors 'none'` e `X-Frame-Options: DENY` | Cabeçalhos conferidos | ✅ |
| **SSRF, traversal, comandos** | A aplicação não busca URLs, não lê caminhos nem executa comandos a partir de entrada | Revisão de código | ✅ Sem superfície |
| **Upload malicioso** | Não há upload nesta etapa | — | — |
| **Dependências** | Lockfile; `npm audit` | `npm audit`: 9 achados, todos em ferramentas de desenvolvimento; SBOM CycloneDX gerado | ⚠️ Correção sugerida pelo npm é rebaixar versões; acompanhar atualizações |
| **Segredos** | Gerados por `npm run setup` em dois arquivos (app / operação), fora do código e do git | secretlint (preset recomendado): 0 achados | ✅ |
| **Lembretes e tarefas de fundo** | Processador sem rota HTTP; revalida plano vigente e autorização antes de cada envio; `SKIP LOCKED`; texto sem dado clínico | Testes de lembrete (dois processadores, revogação, atraso) | ✅ |
| **IA (prompt injection, troca de números)** | Texto como dado delimitado; sem ferramentas; verificação determinística de números/unidades/negações; revisão humana; desligada por padrão | Testes com modelo simulado | ⚠️ Chamada real não executada |
| **Backups** | Snapshot consistente, AES-256-GCM por arquivo, chave fora das cópias, SHA-256 no manifesto; pós-restauração apaga sessões e revoga convites | Restauração conferida em banco separado | ✅ Agendamento e retenção dependem do ambiente |

## Ferramentas executadas

SAST (eslint-plugin-security, 63 alertas triados, 1 corrigido), segredos (secretlint, 0), SBOM (CycloneDX 1.6) e DAST próprio limitado a localhost contra o build de produção (29/29). Detalhes no [relatório](relatorio-testes.md).

## O que não foi feito

- DAST com ferramenta dedicada (ex.: OWASP ZAP) e revisão de segurança independente.
- Teste com leitor de tela; passkey em aparelho físico.
- Mapeamento requisito a requisito do ASVS 5.0.0 (capítulos relevantes: V1 codificação e sanitização, V2 validação e lógica de negócio, V3 front-end, V6 autenticação, V7 sessões, V8 autorização, V11 criptografia, V13 configuração, V14 proteção de dados, V16 registro de segurança e erros).

**Um relatório sem achados não comprova ausência de vulnerabilidades.** Antes de qualquer uso real: resolver achados críticos e altos aplicáveis, fazer revisão de segurança independente e as revisões institucional, jurídica e regulatória.
