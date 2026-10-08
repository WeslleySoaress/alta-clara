"use client";

import { passkeyClient } from "@better-auth/passkey/client";
import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authCliente = createAuthClient({
  plugins: [
    passkeyClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        // Navegação completa de propósito: garante que o novo cookie de sessão valha em toda a página.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/entrar/verificacao");
      },
    }),
  ],
});
