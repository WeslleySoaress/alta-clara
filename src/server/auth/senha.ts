import { hash, verify } from "@node-rs/argon2";

// Argon2id com os parâmetros mínimos recomendados pela OWASP
// (Password Storage Cheat Sheet): m=19 MiB, t=2, p=1.
const PARAMETROS = { memoryCost: 19_456, timeCost: 2, parallelism: 1, algorithm: 2 /* Argon2id */ } as const;

export const SENHA_MIN = 15; // NIST SP 800-63B-4: 15 quando a senha é fator único.
export const SENHA_MAX = 128;

// No máximo N cálculos ao mesmo tempo; os demais esperam numa fila curta.
// Acima do limite da fila, recusa rápido em vez de esgotar memória e CPU.
const MAX_SIMULTANEOS = 4;
const MAX_FILA = 64;
let emUso = 0;
const fila: (() => void)[] = [];

async function comVaga<T>(tarefa: () => Promise<T>): Promise<T> {
  if (emUso >= MAX_SIMULTANEOS) {
    if (fila.length >= MAX_FILA) throw new Error("Servidor ocupado. Tente de novo em instantes.");
    await new Promise<void>((liberar) => fila.push(liberar));
  }
  emUso++;
  try {
    return await tarefa();
  } finally {
    emUso--;
    fila.shift()?.();
  }
}

export function hashSenha(senha: string): Promise<string> {
  return comVaga(() => hash(senha, PARAMETROS));
}

export async function verificarSenha({ hash: h, password }: { hash: string; password: string }) {
  try {
    return await comVaga(() => verify(h, password));
  } catch {
    return false;
  }
}

// Com 15+ caracteres, listas de vazamentos pegam pouco (quase todas as senhas
// vazadas são curtas). O que derruba senhas longas fracas são padrões:
// repetição, sequências de teclado e frases feitas só de palavras óbvias.
// A consulta opcional ao Pwned Passwords (abaixo) cobre o resto.

// Palavras que, sozinhas ou combinadas com números e sequências, não protegem.
const PALAVRAS_OBVIAS = [
  "altaclara", "alta", "clara", "senha", "password", "passw", "pass", "admin", "administrador",
  "qwerty", "teste", "test", "usuario", "user", "login", "entrar", "acesso", "minha", "meu",
  "forte", "segura", "seguro", "secreta", "secret", "hospital", "saude", "paciente", "enfermagem",
  "brasil", "amor", "deus", "jesus", "iloveyou", "welcome", "letmein", "bemvindo", "futebol",
  "flamengo", "corinthians", "palmeiras", "vasco", "gremio", "santos", "nova", "novo", "abc",
] as const;

const SEQUENCIAS = ["abcdefghijklmnopqrstuvwxyz", "01234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm", "1qaz2wsx3edc", "qazwsxedc"];

const LEET: Record<string, string> = { "@": "a", "4": "a", "3": "e", "1": "i", "!": "i", "0": "o", "$": "s", "5": "s", "7": "t" };

function normalizar(senha: string) {
  return senha
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "");
}

/** Repete um trecho curto ("abcabcabc…", "senhasenha…"). */
function ehRepeticao(s: string) {
  for (let k = 1; k <= Math.min(8, Math.floor(s.length / 2)); k++) {
    const unidade = s.slice(0, k);
    if (unidade.repeat(Math.ceil(s.length / k)).slice(0, s.length) === s) return true;
  }
  return false;
}

/** Remove trechos de 3+ caracteres que seguem uma sequência (em qualquer sentido). */
function semSequencias(s: string) {
  const fontes = SEQUENCIAS.flatMap((q) => [q, [...q].reverse().join("")]);
  let resto = "";
  let i = 0;
  while (i < s.length) {
    let maior = 0;
    for (const fonte of fontes) {
      const inicio = fonte.indexOf(s.slice(i, i + 3));
      if (inicio < 0) continue;
      let n = 0;
      while (i + n < s.length && fonte[inicio + n] === s[i + n]) n++;
      maior = Math.max(maior, n);
    }
    if (maior >= 3) i += maior;
    else resto += s[i++];
  }
  return resto;
}

/** Sobra pouco depois de tirar palavras óbvias, sequências, números e símbolos? */
function ehPrevisivel(s: string, extras: string[]) {
  const palavras = [...extras, ...PALAVRAS_OBVIAS].filter((p) => p.length >= 3).sort((a, b) => b.length - a.length);
  const sobra = (texto: string) => {
    let resto = texto;
    for (const p of palavras) resto = resto.split(p).join(" ");
    return semSequencias(resto.replace(/ /g, "")).replace(/[^a-z]/g, "").length;
  };
  // Testa como digitada e com troca de símbolos por letras ("p@ssw0rd").
  return sobra(s) < 5 || sobra([...s].map((c) => LEET[c] ?? c).join("")) < 5;
}

/** Mensagem de erro em linguagem simples, ou null se a senha é aceitável. */
export function problemaNaSenha(senha: string, email?: string): string | null {
  if (senha.length < SENHA_MIN) return `Use pelo menos ${SENHA_MIN} caracteres. Uma frase com espaços funciona bem.`;
  if (senha.length > SENHA_MAX) return `Use no máximo ${SENHA_MAX} caracteres.`;
  const s = normalizar(senha);
  const local = email ? normalizar(email.split("@")[0]) : "";
  if (local.length >= 3 && s.includes(local)) return "A senha não pode conter o seu e-mail.";
  if (new Set(s).size < 5 || ehRepeticao(s) || semSequencias(s).length < 5 || ehPrevisivel(s, local ? [local] : [])) {
    return "Esta senha é fácil de adivinhar. Tente uma frase com palavras que não combinam, como “janela azul come pipoca”.";
  }
  return null;
}

/**
 * Consulta opcional ao Pwned Passwords com k-anonimato: só os 5 primeiros
 * caracteres do SHA-1 saem do servidor; a senha e o hash completo nunca.
 * Ligada com ALTA_SENHAS_VAZADAS=hibp. Se o serviço falhar, não bloqueia
 * (as outras regras continuam valendo).
 */
export async function senhaVazada(senha: string, buscar: typeof fetch = fetch): Promise<boolean> {
  if (process.env.ALTA_SENHAS_VAZADAS !== "hibp") return false;
  const { createHash } = await import("node:crypto");
  const sha1 = createHash("sha1").update(senha).digest("hex").toUpperCase();
  try {
    const r = await buscar(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return false;
    const sufixo = sha1.slice(5);
    return (await r.text()).split("\n").some((l) => {
      const [h, n] = l.trim().split(":");
      return h === sufixo && Number(n) > 0;
    });
  } catch {
    return false;
  }
}

/** Regras locais + (se ligada) consulta de vazamentos. */
export async function problemaNaSenhaCompleto(senha: string, email?: string): Promise<string | null> {
  const local = problemaNaSenha(senha, email);
  if (local) return local;
  if (await senhaVazada(senha)) return "Esta senha já apareceu em vazamentos de dados. Escolha outra.";
  return null;
}
