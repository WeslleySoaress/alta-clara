import { carregarAmbiente } from "./ambiente";
import { migrarBanco } from "../src/server/db/migrar";

carregarAmbiente({ operacao: true });

migrarBanco(process.env.DATABASE_URL_OWNER!)
  .then(() => console.log("Migrações aplicadas e privilégios ajustados."))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
