import { IconeLua, IconePrato, IconeSol, IconeSolTarde } from "@/components/Icones";
import type { Periodo } from "@/lib/agenda";

export function IconePeriodo({ periodo, tamanho = 22 }: { periodo: Periodo; tamanho?: number }) {
  switch (periodo) {
    case "manha":
      return <IconeSol tamanho={tamanho} />;
    case "almoco":
      return <IconePrato tamanho={tamanho} />;
    case "tarde":
      return <IconeSolTarde tamanho={tamanho} />;
    case "noite":
      return <IconeLua tamanho={tamanho} />;
  }
}
