import { NextResponse } from "next/server";
import { iniciarAtivacao, previsualizarConvite } from "@/server/dominio/convites";
import { requisicaoDaPropriaOrigem } from "@/server/origem";

// Route Handler (e não Server Action) de propósito: definir o cookie aqui não
// dispara a atualização do roteador, que traria o #t= de volta à URL.
// O token chega no corpo de um POST: não fica em URL, histórico ou Referer.

const semCache = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!requisicaoDaPropriaOrigem(request)) return NextResponse.json({ erro: "origem" }, { status: 403, headers: semCache });

  const corpo = (await request.json().catch(() => ({}))) as { token?: unknown; acao?: unknown };
  const token = typeof corpo.token === "string" ? corpo.token : "";

  if (corpo.acao === "previa") {
    return NextResponse.json(await previsualizarConvite(token), { headers: semCache });
  }

  const r = await iniciarAtivacao(token);
  if ("erro" in r) return NextResponse.json({ ok: false, erro: r.erro }, { headers: semCache });

  const resposta = NextResponse.json({ ok: true }, { headers: semCache });
  resposta.cookies.set("alta_ativacao", r.sessaoAtivacao, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/ativar",
    maxAge: 40 * 60,
  });
  return resposta;
}
