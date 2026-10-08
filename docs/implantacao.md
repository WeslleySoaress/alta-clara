# Implantação, backups e próximos passos

> Estas orientações preparam um ambiente de **demonstração sintética**. Implantação clínica exige revisões institucional, jurídica (LGPD), de segurança e regulatória que não foram feitas.

## Ambientes

- Desenvolvimento, teste e produção com bancos, segredos e domínios **separados**. Nunca reutilize os arquivos `.env.local` / `.env.operacao.local` gerados localmente. O processo web recebe só `BETTER_AUTH_*`, `DATABASE_URL` (usuário `alta_app`) e as opções de IA/senhas; a URL do dono do esquema, a senha do superusuário e a chave dos backups ficam só nos jobs de operação — o app se recusa a subir em produção se as receber.
- Segredos em gerenciador do provedor (não em arquivos versionados). `BETTER_AUTH_SECRET` com ≥ 32 bytes aleatórios; trocar invalida sessões e códigos de recuperação cifrados — planeje a rotação.
- Variáveis obrigatórias: ver [`.env.example`](../.env.example).

## Passos de implantação (demonstração)

1. PostgreSQL gerenciado com criptografia em repouso, TLS obrigatório e backups automáticos.
2. Criar os papéis `alta_owner` (migrações) e `alta_app` (aplicação), como em `scripts/db.ts`/`scripts/docker-init.sh`. A aplicação **nunca** usa `alta_owner` nem superusuário.
3. `npm ci && npm run build`; `npm run db:migrate` com `DATABASE_URL_OWNER`.
4. `npm start` atrás de HTTPS (HSTS já é enviado em produção). `BETTER_AUTH_URL` deve ser o domínio público — é usado como RP ID das passkeys e na verificação de origem.
5. Configurar um **provedor real de mensagens** em `src/server/mensagens.ts`. Sem isso, o envio falha em produção (proposital).
6. Proxy reverso sem registro de corpo de requisição.

## Processos em produção

- **Web:** `npm start` (vários processos atrás do balanceador; sessões ficam no banco).
- **Lembretes:** `npm run lembretes` como processo separado (1 ou mais instâncias — `SKIP LOCKED` evita envio duplicado). Configurar um provedor real em `src/server/mensagens.ts`.
- **IA:** só com `ALTA_IA_HABILITADA=1`, credencial do provedor avaliada (retenção, subprocessadores, região) e, em uso clínico, revisão adequada. Não envie dados reais em demonstração.

## Reversão

Implantações imutáveis (imagem/artefato por versão). Migrações só aditivas por padrão; quando houver migração destrutiva, publicar primeiro o código compatível com os dois esquemas. Reverter = voltar ao artefato anterior.

## Backups e recuperação

- Backup diário completo + WAL contínuo (PITR). Cópias cifradas, em conta/região separada, com acesso restrito.
- **Objetivos propostos (a medir, não garantidos):** RPO de 15 min, RTO de 4 h.
- `npx tsx scripts/backup.ts backup` gera cópia lógica cifrada (AES-256-GCM, chave `ALTA_BACKUP_KEY` guardada **fora** das cópias); `restaurar <pasta>` recria o esquema pelas migrações e carrega os dados em `alta_clara_restauracao`.
- Teste de restauração **demonstrado** localmente (`scripts/backup.ts teste`, evidência em `docs/evidencias/backup-restauracao.json`). Em produção, repetir mensalmente em ambiente isolado; o backup lógico complementa, não substitui, o PITR do provedor.
- Restaurar um backup **reintroduz sessões e convites antigos**: após restauração, apagar `session` e revogar convites pendentes.

## Incidentes e indisponibilidade

- O plano impresso entregue na alta é a contingência para indisponibilidade; a tela de urgência sempre mostra 192 e o telefone da unidade.
- Em suspeita de vazamento: revogar todas as sessões (`delete from session`), girar segredos, revogar convites, preservar a auditoria, acionar o encarregado (LGPD).

## Observabilidade

Métricas e alertas operacionais sem dado clínico (taxa de erro, latência, falhas de login, convites expirados). Nada de gravação de sessão ou rastreadores nas páginas clínicas.

## Próximos passos (ordem sugerida)

1. Revisão de segurança independente, DAST com ferramenta dedicada (ex.: OWASP ZAP) e mapeamento requisito a requisito do ASVS 5.0.0.
2. Teste com leitor de tela e pessoas idosas; passkey em aparelhos físicos.
3. Limitação de tentativas por conta (além de por IP) e RLS no PostgreSQL como camada adicional.
4. SSO institucional via OIDC (ex.: Keycloak) e convite de profissionais pela tela do admin.
5. FHIR: escolher versão e perfis do sistema de destino (ex.: RNDS/BR Core), validar com o validador oficial e testar em servidor sandbox com SMART on FHIR.
6. IA: avaliar qualidade com a equipe (conjunto de textos sintéticos, revisão cega), medir custo e testar o assistente para pacientes só depois de recuperação autorizada e testes de vazamento.
7. Salvamento automático de rascunho; normalização dos itens do plano para relatórios.
8. Revisões institucional, jurídica (LGPD), de segurança e regulatória antes de qualquer uso real.
