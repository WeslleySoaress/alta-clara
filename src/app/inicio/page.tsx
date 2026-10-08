import { redirect } from "next/navigation";
import { ehProfissional } from "@/server/authz/politicas";
import { exigirSessao } from "@/server/auth/sessao";

/** Destino depois do login: decidido pelo servidor a partir dos vínculos reais. */
export default async function Page() {
  const { ator } = await exigirSessao();
  redirect(ehProfissional(ator) ? "/equipe" : "/paciente");
}
