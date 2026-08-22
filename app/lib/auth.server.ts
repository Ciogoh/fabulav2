/**
 * L'accesso.
 *
 * Tre modi di entrare, tutti sullo stesso account: **codice via email** (il
 * principale — niente password da dimenticare), **password** per chi la
 * preferisce, e **Google**. Apple è fuori di proposito: richiede l'Apple
 * Developer Program, 99 € l'anno.
 *
 * La registrazione è libera: chiunque può crearsi un account. Il filtro non è
 * all'ingresso ma più avanti, nell'approvazione manuale di ogni richiesta.
 */

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { db } from "~/lib/db.server";
import { sendEmail } from "~/lib/email.server";

const baseURL = process.env.APP_URL ?? "http://localhost:5173";
const isProduction = process.env.NODE_ENV === "production";

/**
 * Senza segreto Better Auth se ne genera uno a caso a ogni avvio: le sessioni
 * si invaliderebbero a ogni riavvio e a ogni ridistribuzione, buttando fuori
 * tutti senza che nessuno capisca perché. Meglio non partire affatto.
 */
if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET non è impostata. Generane una con `openssl rand -base64 32` e mettila nel .env."
  );
}

/** Google si attiva solo se le chiavi ci sono: senza, restano OTP e password. */
const googleConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  baseURL,
  secret: process.env.SESSION_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    async sendResetPassword({ user, url }) {
      await sendEmail({
        to: user.email,
        subject: "Fabula — reset your password",
        text: [
          `Hi ${user.name},`,
          "",
          "You asked to reset your Fabula password.",
          "Open this link to choose a new one:",
          "",
          url,
          "",
          "If this wasn't you, ignore this message: your password stays the same.",
        ].join("\n"),
      });
    },
  },

  socialProviders: googleConfigured
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},

  account: {
    /**
     * **Trovato provando Google sul serio.** Col database configurato,
     * Better Auth di serie tiene lo stato dell'OAuth in due posti che non
     * durano uguale: una riga di verifica nel database (10 minuti) e un
     * cookie firmato (5 minuti). Chi si ferma sulla schermata "Google non
     * ha verificato questa app" più di 5 minuti — probabile la prima volta,
     * con un client ancora in test — torna con la riga ancora valida ma il
     * cookie già scaduto: "state_mismatch". La modalità "cookie" tiene
     * tutto in un solo cookie cifrato, con una sola scadenza a 10 minuti.
     */
    storeStateStrategy: "cookie",
  },

  user: {
    additionalFields: {
      // `input: false` su tutti e tre. Senza, il corpo della richiesta di
      // registrazione potrebbe contenere `role: "ADMIN"` e chiunque si
      // nominerebbe amministratore da solo.
      language: { type: "string", defaultValue: "EN", input: false },
      role: { type: "string", defaultValue: "MEMBER", input: false },
      isMember: { type: "boolean", defaultValue: false, input: false },
    },
  },

  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 60 * 10,
      async sendVerificationOTP({ email, otp, type }) {
        const subject =
          type === "forget-password"
            ? "Fabula — code to reset your password"
            : "Fabula — your sign-in code";

        await sendEmail({
          to: email,
          subject,
          text: [
            "Your code for Fabula:",
            "",
            `    ${otp}`,
            "",
            "Valid for ten minutes. If you didn't request this, ignore this message.",
          ].join("\n"),
        });
      },
    }),
  ],

  // Il dominio pubblico arriva dal tunnel Cloudflare, quindi l'origine delle
  // richieste non coincide con quella del server: va dichiarata, o Better Auth
  // la rifiuta come richiesta proveniente da un altro sito.
  //
  // In sviluppo aggiungiamo le due porte di casa: Vite serve sulla 5173 e il
  // server di produzione sulla 3000, e se `APP_URL` punta a una mentre stai
  // usando l'altra l'accesso fallisce con un secco «Invalid origin».
  trustedOrigins: isProduction
    ? [baseURL]
    : [baseURL, "http://localhost:5173", "http://localhost:3000"],

  /**
   * Limite di frequenza sull'accesso.
   *
   * Il plugin OTP porta già i suoi (tre invii e tre verifiche al minuto), che
   * bastano contro l'indovinello: un codice di sei cifre con trenta tentativi
   * in dieci minuti è fuori portata. Questo è la rete generale sopra a tutto
   * il resto.
   */
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
  },

  advanced: {
    /**
     * **Da non togliere.** Dietro al tunnel Cloudflare tutte le richieste
     * arrivano al server dallo stesso indirizzo: senza dire dove sta scritto
     * l'IP vero, Better Auth mette tutti in un unico secchio condiviso. Il
     * risultato sarebbe tre codici al minuto *per l'intera associazione*, e
     * chiunque potrebbe bloccare l'accesso a tutti gli altri consumandoli.
     *
     * `cf-connecting-ip` lo scrive Cloudflare e non è falsificabile da fuori,
     * perché lo riscrive a ogni passaggio.
     */
    ipAddress: {
      ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
    },
  },
});

export type AuthUser = typeof auth.$Infer.Session.user;
