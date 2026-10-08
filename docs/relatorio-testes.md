# Relatório de testes

Atualizado em 7 de outubro de 2026 (primeira execução em 3 de outubro), Windows 11, Node 22.18, PostgreSQL 18 (embedded-postgres), Chrome instalado. Só dados sintéticos.

## Resumo

| Verificação | Resultado | Evidência |
|---|---|---|
| Testes de domínio, autorização e banco (`npm test`) | **105/105** | `tests/` |
| Ponta a ponta no Chrome (`scripts/e2e.ts`) | **28/28** | [e2e-resultado.json](evidencias/e2e-resultado.json), capturas em [evidencias/](evidencias/) |
| DAST local contra o **build de produção** (`scripts/dast.ts`) | **29/29** | [dast-local.json](evidencias/dast-local.json) |
| Backup cifrado + restauração em banco separado | **Conferido** (23 tabelas, contagens e SHA-256) | [backup-restauracao.json](evidencias/backup-restauracao.json) |
| Acessibilidade automática (axe-core, WCAG 2.x A/AA) em 8 telas | Nenhuma violação detectada | E2E |
| Contraste de 30 pares de cores | Todos ≥ 4,5:1 | `scripts/contraste.ts` |
| SAST (eslint-plugin-security) | 63 alertas triados: **1 real, corrigido**; demais falsos positivos (abaixo) | [sast-eslint-security.json](evidencias/sast-eslint-security.json) |
| Segredos (secretlint, preset recomendado) | 0 achados | [secretlint.json](evidencias/secretlint.json) |
| SBOM (CycloneDX 1.6) | 157 componentes de produção | [sbom-cyclonedx.json](evidencias/sbom-cyclonedx.json) |
| `npm audit` | 9 achados (5 altos, 4 moderados), **todos em ferramentas de desenvolvimento** (eslint-config-next, drizzle-kit/esbuild); 0 críticos | — |
| TypeScript, ESLint, `next build` | Sem erros | — |

## Critérios de aceite (seção 18)

| # | Critério | Situação |
|---|---|---|
| 1 | Profissional cria, revisa e publica; paciente correto acessa | ✅ testes + E2E |
| 2 | Paciente A não lê, altera, pesquisa ou exporta dados de B | ✅ leitura, listagem, registro, questionário, histórico, pedidos de ajuda, exportação FHIR (não profissional) |
| 3 | Instituição A não acessa B | ✅ planos, atendimentos, modelos, pendências, auditoria, vínculos · jobs: o processador revalida plano e autorização antes de cada envio |
| 4 | Cuidador revogado perde acesso | ✅ domínio + E2E (tela) + DAST (sessão real, 404) |
| 5 | Convite expirado, revogado, reutilizado, simultâneo | ✅ |
| 6 | Logout, desligamento e alteração de autenticação invalidam sessões | ✅ logout, desligamento (vínculo desativado apaga sessões), política de inatividade/duração (função pura) · reset de senha revoga sessões: **configurado, não testado** |
| 7 | Caracteres SQL não alteram consultas | ✅ testes + DAST |
| 8 | Conteúdo malicioso não executa; alteração sem proteção é rejeitada | ✅ render com `<script>`, CSRF por Origin/JSON, CSP em produção |
| 9 | Recuperação e troca de autenticador não contornam a proteção | ✅ passkey exige login recente (403 com sessão de 20 min — testado) · TOTP continuar exigido após reset: comportamento da biblioteca, **não testado** |
| 10 | Nova versão cancela lembretes antigos e preserva histórico | ✅ |
| 11 | Registro duplicado/concorrente; fuso e virada de data | ✅ doses e lembretes (dois processadores em paralelo) |
| 12 | Teclado e leitor de tela | ⚠️ teclado no login + axe em 8 telas · **leitor de tela não testado** (roteiro abaixo) |
| 13 | Logs, URLs, notificações e arquivos sem informação clínica nem segredos | ✅ incluindo o log do servidor no E2E |
| 14 | Restauração de backup | ✅ demonstrada em banco separado |
| 15 | IA: afirmações sem fonte, troca de números, prompt injection, vazamento | ⚠️ **parcial:** verificação determinística testada (números, unidades, negações) e fluxo com modelo simulado, incluindo texto com tentativa de injeção. **A chamada real ao modelo não foi executada** (sem credencial). Vazamento entre pacientes não se aplica: a IA só recebe o texto que o profissional está editando |

## Triagem do SAST

| Regra | Ocorrências | Avaliação |
|---|---|---|
| `detect-object-injection` em `entrar/page.tsx` (`MENSAGENS[motivo]` com valor da URL) | 1 | **Real (baixo).** `?motivo=__proto__` acessava o protótipo. Corrigido com `Object.hasOwn`. |
| `detect-object-injection` restantes | 49 | Falso positivo: índices numéricos de listas no estado do formulário e mapas com chaves de enums fechados. |
| `detect-non-literal-fs-filename` | 7 | Scripts de operação (backup, E2E) com caminhos definidos pelo operador. Sem entrada de usuário. |
| `detect-unsafe-regex` / `detect-non-literal-regexp` em `ia.ts` | 2 | Regex linear (`\d+(?:[.,]\d+)?`) sobre texto limitado a 1.500 caracteres; regex de unidade montada de lista fixa. |
| Referências a regra não carregada | 4 | Comentários `eslint-disable` de outra configuração. |

## Falhas encontradas pelos testes e corrigidas

1. Token, código e senha apareciam no log do servidor de desenvolvimento (argumentos de Server Functions) → `logging.serverFunctions: false` + verificação no E2E.
2. A ativação voltava ao início depois de enviar o código (atualização do roteador trazia o `#t=`) → Route Handler com verificação de origem.
3. `?motivo=__proto__` no login (SAST) → `Object.hasOwn`.
4. Ajustes nos próprios testes (código de erro do PostgreSQL, espera de navegação, prefixo `__Secure-` do cookie em produção, detector de pilha que confundia IDs de módulo do modo dev com stack trace).

## Não verificado

- **Leitor de tela** (NVDA, VoiceOver, TalkBack) e zoom 200–400% — requer pessoa. Roteiro sugerido: (1) entrar só com teclado e leitor; (2) ouvir a "Próxima ação" e registrar uma dose; (3) navegar pelos três grupos de "Quando procurar ajuda"; (4) responder à confirmação de entendimento; (5) ativar o aviso de sessão na área da equipe.
- **Passkey em aparelho físico** (testada com autenticador WebAuthn virtual do Chrome).
- **Chamada real à IA** e avaliação da qualidade das sugestões.
- **FHIR** em validador oficial ou servidor de testes; SMART on FHIR.
- **DAST com ferramenta dedicada** (ex.: OWASP ZAP) — indisponível no ambiente (sem Docker/Java 21); o DAST feito é um roteiro próprio, limitado a localhost.
- `docker-compose.yml` (Docker indisponível); carga e limite de taxa em rede compartilhada.

**Um relatório sem achados não comprova ausência de vulnerabilidades.**

## Rodada 3 — revisão de código, correções e segurança (4 de outubro de 2026)

Dois revisores (correção e segurança) leram o código inteiro. Achados verificados e corrigidos, cada um com teste em `tests/etapa3.test.ts`:

| Achado | Gravidade | Correção |
|---|---|---|
| Limite de tentativas burlável trocando `X-Forwarded-For`; sem limite por conta | Alta | Bloqueio progressivo **por conta** (5 falhas → 1 min; 10 → 15 min; nunca permanente), igual para e-mail existente ou não; `ALTA_PROXIES_CONFIAVEIS` para o proxy de produção; teto de 4 cálculos Argon2 simultâneos |
| Lembretes não voltavam depois de desligar/religar ou de reconvidar cuidador | Alta | Reagendamento reativa só o que foi cancelado por escolha/revogação |
| Lembrete podia sair em dobro (ciclo lento ou dois processadores) | Alta | Reserva `enviando` na mesma transação, recuperação de reservas antigas, ciclos sem sobreposição |
| Nova versão "zerava" doses já marcadas no dia (risco de dose dobrada) | Média | Registros valem entre versões do mesmo atendimento |
| Inatividade de 15 min não valia nas rotas `/api/auth/*` | Média | Mesma política aplicada no hook da biblioteca |
| Trocar o próprio nome falsificava autorias e auditoria | Média | `/update-user` desativado |
| Separação de funções burlável (autor sobrescrito pelo último editor) | Média | Lista de **editores** da versão; nenhum deles aprova; autor imutável |
| Código de ativação: ~21 mil palpites ao longo de 72 h | Média | Até 5 envios e 15 tentativas por convite; depois revoga e abre pendência |
| `/dev/mensagens` acessível na rede local | Média | Só `localhost`; servidor de desenvolvimento escuta só em 127.0.0.1 |
| Versão substituída aberta sem aviso | Média | Aviso com link para a versão vigente |
| Datas formatadas sem fuso (servidor em UTC / hidratação) | Média | Formatadores únicos com `America/Sao_Paulo` |
| "O que mudou" não via mudança de primeiro dia, unidade e equipe | Média | Campos incluídos |
| Revogação de cuidador mostrava erro se o e-mail falhasse | Média | Transação + aviso sem bloquear |
| Sugestão da IA podia cair no item errado após remover outro | Média | Chaves estáveis por item |
| `trustDevice` permitia pular o 2FA por 30 dias | Baixa | Recusado |
| Senha comum aceita na troca/redefinição; sem aviso de troca | Baixa | Validação e aviso por mensagem |
| Botões presos, tela "lendo convite" infinita, envios duplos | Baixa | `catch`/estado ocupado em todos os fluxos |
| Rascunho já aberto virava erro genérico | Baixa | Mensagem clara |
| Pedidos de ajuda visíveis entre cuidadores | Baixa | Cada cuidador vê só os seus; titular vê todos |
| IA sem cota; convites de cuidador ilimitados | Baixa | 40 sugestões/dia; até 5 convites pendentes e 10/dia |
| Enumeração por tempo/erro na recuperação de senha | Baixa | Envio em segundo plano |
| `.ics` sem `VTIMEZONE`; editor com números e mensagens confusos | Baixa | Corrigidos |

**Funções novas:** registro de remédio "se necessário" com intervalo mínimo e máximo por dia do plano (verificado no servidor, com trava contra registros simultâneos); diário de doses relatadas para a equipe; troca de senha; lista de aparelhos conectados com encerramento individual (sem expor tokens); aviso por mensagem a cada novo acesso; cabeçalhos `Cross-Origin-Resource-Policy`, `Origin-Agent-Cluster` e `X-DNS-Prefetch-Control`.

**Resultados:** 82/82 testes automatizados, 28/28 no navegador, DAST 27/27 contra o build de produção (força bruta bloqueada na 6ª tentativa).

**Ainda pendente ao fim da rodada 3:** resolvido na rodada 4, exceto a validação da IA contra instruções novas sem números.

## Rodada 4 — acabamento (7 de outubro de 2026)

| Item | Correção | Verificação |
|---|---|---|
| App recebia segredos de operação (`DATABASE_URL_OWNER`, senha do superusuário, chave de backup) | Dois arquivos: `.env.local` (app) e `.env.operacao.local` (scripts); migração automática do arquivo antigo; o app recusa subir em produção com esses valores ou conectado como dono | Build de produção e E2E sem aviso |
| Prefetch do `next/link` saía sem `no-store` | `proxy.ts` trata o prefetch (sem nonce, que não se aplica) e marca rotas sensíveis | DAST: 2 verificações novas |
| Lista de senhas comuns pequena | Regras de padrão para senhas longas (repetição, sequências, variedade, palavras óbvias, troca de símbolos) e consulta opcional ao Pwned Passwords por k-anonimato, sem bloquear se o serviço cair | 23 testes novos (`tests/etapa4.test.ts`) |
| Pendência de entendimento com pontos grudados por “|” | Um ponto por linha; faixa e selo coloridos por tipo de pendência | Captura [09-pendencias.png](evidencias/09-pendencias.png); axe sem violações |
| Indicador do modo dev cobria o QR e botões nas capturas (E2E falhava às vezes ao ler o QR) | `devIndicators: false` e remoção do indicador antes da leitura | E2E 28/28 |

**Resultados:** 105/105 testes automatizados, 28/28 no navegador, DAST 29/29 contra o build de produção.

**Ainda pendente:** validação da IA contra instruções novas sem números; consulta real ao Pwned Passwords; leitor de tela; passkey em aparelho físico; validador FHIR oficial; OWASP ZAP.
