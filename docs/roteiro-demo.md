# Roteiro de demonstração (cerca de 3 minutos)

**Preparação:** `npm run db`, `npm run db:seed -- --reset`, `npm run dev -- --port 3100`. Tenha `.dev-credenciais.md` e um aplicativo autenticador no celular. Antes da apresentação, faça o primeiro acesso da Ana (enfermagem) e do Bruno (revisor) para cadastrar o segundo fator, publique um plano da Maria e ative a conta dela pelo QR code. (Não rode `scripts/e2e.ts` depois: ele recria os dados e cadastra o 2FA com segredos que ficam só no teste.)

**0:00 — O problema (15 s).** Abra `/`. "As orientações de alta costumam ser verbais ou em papel. O Alta Clara transforma isso num plano claro, revisado pela equipe e rastreável."

**0:15 — A equipe (45 s).** Como **Ana**: abra Maria → **Abrir nova versão** ("ajuste de horário") → mude um horário → **Enviar para revisão**. Mostre o botão de IA desligado ("indisponível neste ambiente": nada sai sem habilitação explícita). Saia; como **Bruno**, digite o prontuário e **Aprovar e publicar**. "Quem escreve não aprova; o prontuário evita o paciente errado."

**1:00 — O paciente (50 s).** Entre como **Maria** (com passkey, se cadastrada). Mostre:
- o aviso **"Suas orientações foram atualizadas — ver o que mudou"**: antes/depois, quem revisou e o motivo;
- **O que preciso fazer hoje?**, a próxima ação e os registros *Marquei como tomado / Não tomei / Tenho dúvida*;
- **Quando procurar ajuda** em três grupos, sem "normal" em verde;
- **Confirme que entendeu**: responda "não sei" numa pergunta.

**1:50 — O cuidador (40 s).** Em **Quem me ajuda**, convide "Filha Joana" com registro de remédios por 30 dias. Abra o QR em outra janela: o código vai para o e-mail da Joana (`/dev/mensagens`), ela cria a **própria conta** e vê "Cuidando de Maria". Volte à Maria e **Encerrar acesso** — atualize a janela da Joana: o plano sumiu.

**2:30 — Fechando o ciclo (20 s).** Como **Ana**, abra **Pendências**: a confirmação de entendimento virou "Orientação a reforçar". Registre a resolução.

**2:50 — Fechamento (10 s).** "Tudo é sintético. 105 testes, 28 verificações no navegador e 29 no DAST local contra o build de produção — e o relatório diz o que ainda não foi verificado."
