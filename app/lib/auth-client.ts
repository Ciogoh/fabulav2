/**
 * Il lato browser dell'accesso.
 *
 * `baseURL` non è impostato di proposito: senza, Better Auth usa l'origine
 * della pagina. È quello che serve dietro al tunnel Cloudflare, dove il
 * dominio pubblico non coincide con quello su cui gira il server.
 */

import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});
