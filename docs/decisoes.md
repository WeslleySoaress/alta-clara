# Decisões de projeto

Data: 3 de outubro de 2026. Cada decisão indica o motivo e o que ficou como limite. Referências na [pesquisa](pesquisa.md).

## 1. Stack

| Escolha | Motivo | Limite |
|---|---|---|
| Next.js 16 (App Router) + React 19 + TypeScript | Um projeto para os dois públicos; Server Actions já verificam a origem (CSRF) | Versão nova: APIs conferidas na documentação embutida (`node_modules/next/dist/docs`) |
| PostgreSQL 18 | Transações, restrições, índices parciais (uma versão publicada por atendimento) | Local via `embedded-postgres` (binários oficiais); Docker opcional |
| Drizzle ORM | Consultas parametrizadas e tipadas; SQL bruto só com `sql\`\`` parametrizado | ORM não torna SQL bruto seguro: nenhum trecho concatena texto do usuário |
| Zod | Valida todo conteúdo de plano no servidor | — |

**Ambiente sem Docker.** A máquina de desenvolvimento não tinha Docker, WSL nem Java 21. Em vez de pedir instalação de infraestrutura, o banco roda pelos binários oficiais do PostgreSQL empacotados pelo `embedded-postgres`. O `docker-compose.yml` existe para quem tem Docker, mas **não foi executado** neste ambiente.

## 2. Identidade

- **Biblioteca mantida: Better Auth 1.7** (não um protocolo próprio). Oferece sessões no servidor, TOTP, passkeys (WebAuthn via SimpleWebAuthn, com verificação de challenge, origem e RP ID) e cliente OIDC genérico. Telemetria **desligada**.
- **Por que não Keycloak agora:** exigia Java 21 ou Docker, indisponíveis. Keycloak (ou o IdP do hospital) continua sendo o caminho para **SSO institucional via OIDC** — por isso o botão "Entrar com minha instituição" **não aparece**: o requisito pede mostrar só métodos realmente integrados.
- **Senhas:** Argon2id (m=19 MiB, t=2, p=1 — mínimo da OWASP) via `@node-rs/argon2`; 15 a 128 caracteres (NIST SP 800-63B-4: 15 quando a senha é fator único); lista local de senhas comuns (pequena — trocar por lista ampla antes de uso real); sem regras de composição nem troca periódica; colar e gerenciadores permitidos.
- **Sem cadastro aberto.** Contas de paciente nascem da ativação por convite; profissionais, de provisionamento institucional (seed na demo). Ninguém escolhe o próprio papel.
- **MFA obrigatório para profissionais:** sem TOTP ativo, o servidor redireciona para a configuração antes de qualquer tela da equipe, e as regras de autorização exigem `mfaAtivo`.
- **Biometria fica no aparelho.** Passkeys exigem verificação do usuário no autenticador; o Alta Clara só recebe a chave pública.
- **Cadastrar/remover passkey, gerar códigos de recuperação ou desligar o 2FA exige login recente (10 min)** — uma sessão esquecida aberta não vira atalho para trocar autenticadores. Cadastro de passkey gera aviso por mensagem.
- **Códigos de recuperação:** 10, uso único, cifrados com o segredo do servidor (opção `encrypted` da biblioteca). Limite: cifra reversível, não hash — documentado como risco residual.
- **Sem enumeração de contas:** login e recuperação respondem igual exista ou não o e-mail (testado).

## 3. Sessões

- Sessão no banco, cookie `HttpOnly`, `SameSite=Lax`, `Secure` em produção. Nada de token em `localStorage`. Novo identificador a cada login.
- **Política do protótipo** (escolha a validar no fluxo real; OWASP sugere 15–30 min de inatividade e 4–8 h absolutas):
  - profissionais: **15 min de inatividade, 8 h absolutas**;
  - pacientes/cuidadores: 24 h de inatividade, 7 dias absolutos.
- A política por perfil é aplicada em `src/server/auth/sessao.ts` a cada requisição; a sessão expirada é **apagada no servidor** (revogação efetiva) e o motivo vai para a auditoria.
- Sair, redefinir senha (`revokeSessionsOnPasswordReset`) e "encerrar outros aparelhos" removem sessões no servidor.
- A regra é uma função pura (`politica-sessao.ts`), testada. Profissionais recebem **aviso 2 min antes** de expirar, com "Continuar conectado" (continuidade autenticada: só renova uma sessão ainda válida).
- **Desligamento:** desativar o vínculo apaga todas as sessões da pessoa (testado).
- **Limite conhecido:** rascunhos são salvos no servidor pelo botão "Salvar rascunho" (não há salvamento automático).

## 4. QR code de ativação

1. O QR contém `https://…/ativar#t=<token>`. O token tem **256 bits** e vai no **fragmento** (`#`): o navegador **não envia fragmentos ao servidor**, então ele não aparece em logs de acesso, proxies nem no `Referer`.
2. O banco guarda só o **SHA-256** do token.
3. A página lê o fragmento, **remove-o da barra de endereço** e faz a pré-visualização por `POST` (não consome nada e não mostra dado clínico — só a instituição e o e-mail mascarado).
4. "Enviar código" troca o token por uma **sessão de ativação** em cookie `HttpOnly`, `SameSite=Strict`, restrito a `/ativar`, e envia um código de 6 dígitos ao **contato validado no atendimento** (HMAC no banco, 10 min, 5 tentativas). QR e código chegam por canais diferentes.
5. A criação da conta **consome o convite atomicamente** (`UPDATE … WHERE consumido_em IS NULL … RETURNING`), conferindo e-mail, validade e verificação do código. Duas requisições simultâneas: só uma vence (testado).
6. Gerar um novo QR revoga o anterior. O vencimento do convite **não apaga** o plano.
7. Em desenvolvimento o Next registra argumentos de Server Functions no terminal: isso foi **desligado** (`logging.serverFunctions: false`) depois que o teste de ponta a ponta encontrou o token no log.

## 5. Fluxo e conteúdo clínico

- Estados: `rascunho → em_revisao → publicado → substituido`, mais `encerrado` (modelado, sem tela ainda). Cada versão publicada é imutável, com autor, revisor e data; alterar cria nova versão. A versão anterior continua valendo até a nova ser aprovada.
- **Separação de funções:** quem escreveu a versão não a aprova (testado).
- **Confirmação contra paciente errado:** para publicar, o revisor digita o prontuário (testado) e marca que conferiu com a prescrição.
- **Modelos não trazem medicamentos.** Medicamentos são transcritos da prescrição revisada; o formulário avisa que não emite prescrição.
- **Regimes "se necessário" não viram horários fixos** (validação impede os dois ao mesmo tempo).
- **Registros relatados ≠ ingestão comprovada.** A interface diz isso; "Não tomei" orienta a não dobrar a dose e a ligar para a unidade; "Tenho dúvida" diz que a equipe **não acompanha em tempo real**.
- **Alertas sem falsa tranquilização:** três grupos com os nomes do requisito; "previsto" em azul (nunca verde ou "normal"); aviso fixo de que a ausência de um sintoma não significa segurança; 192 sempre visível.
- **Imagens de medicamentos:** só ícones genéricos da forma (cápsula, comprimido…), sem imitar embalagem. Demo usa "Medicamento demonstrativo A/B/C".
- **Todo conteúdo clínico da demonstração é marcado `[Exemplo]`** e não foi validado por profissional.

## 6. Privacidade (LGPD)

- Protótipo sem dados reais; faixa "Demonstração — dados fictícios" em todas as páginas.
- Página do paciente sem rastreadores, sem recursos de terceiros (CSP `default-src 'self'`), `Referrer-Policy: no-referrer`, `Cache-Control: no-store` nas rotas sensíveis.
- Registros de dose ficam no servidor; preferências de interface (letra maior) no aparelho. **Nenhum dado clínico em `localStorage`/service worker.**
- Mensagens nunca citam medicamento, procedimento ou diagnóstico (testado).
- Link difícil de adivinhar **não** é anonimização: o acesso ao plano exige conta autenticada.
- **Antes de uso real:** finalidades, bases legais (art. 11 da LGPD para dados de saúde), retenção, agentes de tratamento, avaliação de fornecedores e de transferência internacional — **não feitos**.

## 7. Acessibilidade

- Fonte Atkinson Hyperlegible Next (feita para baixa visão), base de 18 px, opção "Letra maior", contraste AA verificado por script, alvos ≥ 44 px, foco visível, `prefers-reduced-motion`, impressão legível.
- Login sem CAPTCHA, com colar, mostrar/ocultar senha e gerenciadores (WCAG 2.2 — 3.3.8).
- Leitura em voz alta só por acionamento, com "Parar". Usa a voz do sistema: **pode ser processada por serviço do fabricante** (dito na tela).
- Verificação automática com axe-core em 8 telas: sem violações detectadas. **Leitor de tela e revisão manual completa ainda não foram feitos** (roteiro manual no [relatório](relatorio-testes.md)).

## 8. Recursos da etapa 2

### Círculo de cuidado
- Só o paciente convida. Escopo explícito (`ver_plano` sempre; `registrar_dose` opcional) e validade (30/90/365 dias ou até revogar).
- **Canais separados:** o link/QR vai do paciente para o cuidador (pessoalmente ou por mensagem); o **código vai ao e-mail do cuidador**. O cuidador cria a **própria conta** — nunca usa a senha do paciente.
- A revogação vale na próxima requisição (o ator é recarregado do banco a cada requisição) e cancela os lembretes pendentes do cuidador.
- Autoria: cada registro de dose mostra quem registrou.

### Confirmação de entendimento
- Perguntas **determinísticas** a partir do plano aprovado (horários, uso "se necessário", grupo de um sinal de urgência e de contato) — sem IA e sem conteúdo clínico novo. Inspirada no *teach-back* do AHRQ RED ([pesquisa](pesquisa.md)).
- O navegador nunca recebe a resposta certa; a correção é no servidor. Opção "Não sei" sempre disponível; uma pergunta por vez (modo de simplicidade).
- Erros e "não sei" viram pendência para a equipe reforçar. A interface diz que acertar não certifica compreensão.

### "O que mudou na minha alta?"
- Comparação campo a campo entre versões publicadas consecutivas (dose, via, horários, duração, observação, cuidados, orientações, retornos, contato), com autor, revisor, data e motivo.

### Pendências após a alta
- Geradas pelo sistema (retorno publicado sem data; "Tenho dúvida" numa dose; confirmação com erros) ou pelo paciente/cuidador ("dúvida", "não consigo um remédio"; no máximo 5 abertas por pessoa e plano).
- **Não são triagem:** a tela lembra que o espaço não é acompanhado em tempo real e mantém as orientações de urgência visíveis. Uma chave única entre as abertas evita duplicação.

### Lembretes no servidor
- Gerados na publicação para os próximos 7 dias e renovados pelo processador. O instante em UTC é calculado do horário local **no fuso do plano**.
- Nova versão cancela os pendentes da anterior **na mesma transação** da publicação. Desligar a preferência ou revogar o cuidador também cancela.
- Envio com `FOR UPDATE SKIP LOCKED` (dois processadores não duplicam — testado), até 3 tentativas, e **nunca** um lembrete atrasado mais de 60 min.
- Texto fixo e discreto: sem nome de remédio, procedimento ou diagnóstico. "Enviado" não significa visto; a tela diz que lembretes podem falhar.

### Administração e auditoria
- Admin desativa/reativa vínculos da própria instituição (nunca o próprio). Auditor e admin consultam a trilha **sem conteúdo clínico** e sem nome de paciente; a consulta também é auditada.

### HL7 FHIR R4 (sandbox)
- Exportação de um Bundle `collection` (Patient, Encounter, CarePlan, MedicationRequest) marcado com a tag `sandbox`. **R4** porque o SMART App Launch v2.2 se baseia nele.
- `MedicationRequest.intent = "plan"`: é a transcrição para o plano de alta, não uma prescrição. "Se necessário" vira `asNeededCodeableConcept` + `maxDosePerPeriod`, sem horários fixos.
- **Não há conexão, SMART on FHIR nem gravação em prontuário.** Perfis nacionais (RNDS/BR Core) não foram aplicados e o arquivo não passou por validador oficial.

### IA (opcional, só para a equipe)
- Modelo `claude-opus-5-5` pelo SDK oficial, saída estruturada (Zod), esforço baixo e *fallback* do servidor para recusas de classificadores.
- Desligada por padrão: exige `ALTA_IA_HABILITADA=1` **e** credencial. Sem isso, o botão aparece como indisponível e nada é enviado a terceiros.
- O texto entra **delimitado como dado**; o prompt manda tratar instruções dentro dele como texto.
- **Verificação determinística** descarta sugestões que mudem números ou unidades ou removam negações. O profissional vê a sugestão ao lado e decide; nada é publicado sem a revisão normal.
- A auditoria registra o uso, **não** o texto. Não há assistente para pacientes nesta etapa (exigiria recuperação autorizada, citação de seção e testes de vazamento entre pacientes).
