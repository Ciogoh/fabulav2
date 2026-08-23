/**
 * L'accesso.
 *
 * Quattro modi di entrare, tutti sullo stesso account: **codice via email** (il
 * principale — niente password da dimenticare), **password** per chi la
 * preferisce, **Google** e **Microsoft**. Apple è fuori di proposito: richiede
 * l'Apple Developer Program, 99 € l'anno.
 *
 * Microsoft conta più degli altri due: l'associazione sta dentro a un'università
 * dove ognuno ne ha già uno, e l'indirizzo che ne arriva è quello
 * istituzionale — che dice anche a quale facoltà appartiene chi chiede, e a
 * quale casella scrivere per rispondere.
 *
 * La registrazione è libera: chiunque può crearsi un account. Il filtro non è
 * all'ingresso ma più avanti, nell'approvazione manuale di ogni richiesta.
 */

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { db } from "~/lib/db.server";
import { sendEmail } from "~/lib/email.server";
import { cleanName, givenNameLast } from "~/lib/person";

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

/**
 * Ogni provider si attiva solo se le sue chiavi ci sono: senza, restano OTP e
 * password.
 *
 * Sono **esportate** perché la schermata d'accesso deve decidere se disegnare
 * il pulsante con lo stesso metro con cui qui si decide se registrare il
 * provider. Prima il pulsante di Google guardava il solo `CLIENT_ID`: con
 * l'identificativo riempito e il segreto no, il pulsante c'era e premerlo
 * finiva in errore.
 */
export const googleConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET);

export const microsoftConfigured =
  Boolean(process.env.MICROSOFT_CLIENT_ID) &&
  Boolean(process.env.MICROSOFT_CLIENT_SECRET);

/**
 * Il nome come lo vogliamo noi: «Samuele Mogno», nome davanti.
 *
 * Restituisce un oggetto **vuoto** e non `undefined` quando non sa che fare,
 * perché finisce dentro a uno spread: `name: undefined` sovrascriverebbe il
 * nome buono con il vuoto.
 */
function nameFrom(given?: string, family?: string, full?: string): { name?: string } {
  const first = cleanName(given ?? "");
  const last = cleanName(family ?? "");
  if (first && last) return { name: `${first} ${last}` };

  // Ripiego: dal nome per esteso, che qui è «Cognome Nome (Facoltà Anno)».
  if (full) {
    const guessed = givenNameLast(full);
    if (guessed.firstName && guessed.lastName) {
      return { name: `${guessed.firstName} ${guessed.lastName}` };
    }
  }
  return {};
}

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

  socialProviders: {
    ...(googleConfigured
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {}),

    ...(microsoftConfigured
      ? {
          microsoft: {
            clientId: process.env.MICROSOFT_CLIENT_ID!,
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
            /**
             * Il tenant è quello di unibz, non `common`, e non per scelta:
             * l'applicazione è registrata nella directory dell'ateneo per una
             * sola organizzazione — il valore predefinito del portale — e
             * un'applicazione così sull'endpoint condiviso riceve
             * `AADSTS50194`. Di conseguenza **questo pulsante vuol dire
             * «entra con l'account dell'ateneo»**, ed è per questo che si
             * chiama «Scientific Network South Tyrol» e non «Microsoft»
             * (`signin.microsoft` in `i18n/dictionaries.ts`).
             * Chi socio è ma qui non studia entra col codice via email, che
             * accetta qualunque indirizzo: nessuno resta fuori. Per aprirlo a
             * qualsiasi conto Microsoft si cambiano i «tipi di account
             * supportati» nel portale e si svuota `MICROSOFT_TENANT_ID` — è
             * una riga di `.env`, non di codice, proprio perché è una
             * decisione e non un dettaglio tecnico.
             */
            tenantId: process.env.MICROSOFT_TENANT_ID || "common",

            /**
             * La foto arriva da Microsoft Graph e Better Auth la mette in
             * `image` **come dato in linea**, non come indirizzo: una stringa
             * `data:image/jpeg;base64,…` dentro alla colonna. Non è un difetto
             * — anzi, evita di dire a Microsoft da quale pagina la si sta
             * guardando — ma va saputo, perché `image` viaggia in ogni
             * risposta che contiene l'utente. A 96 pixel sono pochi kilobyte;
             * a 432 sarebbero cento.
             */
            profilePhotoSize: 96,

            mapProfileToUser: (profile) => ({
              /**
               * **La pretesa `email` è facoltativa sui conti di un'organizzazione.**
               * Se chi amministra il dominio non l'ha accesa fra le «optional
               * claims», arriva vuota e l'account nascerebbe senza indirizzo —
               * proprio la cosa che ci interessa di più. `preferred_username` e
               * `upn` portano lo stesso indirizzo e ci sono sempre.
               */
              email:
                profile.email ?? profile.preferred_username ?? profile.upn,

              /**
               * **Il nome per esteso dell'università è inservibile così com'è.**
               * `name` arriva come «Mogno Samuele (Student DES 25)»: cognome
               * davanti, e in coda facoltà e anno. Chi lo divide in due campi
               * si ritrova il cognome nel nome e mezzo corso di laurea nel
               * cognome — è successo davvero al primo accesso.
               *
               * Il token però porta anche `given_name` e `family_name`
               * separati, che è l'unico modo per saperlo: da una stringa sola
               * «Mogno Samuele» e «Samuele Mogno» sono indistinguibili.
               * Ricomponiamo `name` da quelli, e la parentesi la toglie
               * `cleanName` — se un giorno finisse anche dentro al cognome.
               *
               * Se i due campi non arrivassero, resta il nome per esteso, che
               * qui sappiamo leggere: l'applicazione è legata al tenant
               * dell'università, dove **il primo pezzo è sempre il cognome**.
               */
              ...nameFrom(profile.given_name, profile.family_name, profile.name),
            }),
          },
        }
      : {}),
  },

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

    /**
     * **Chi è già entrato col codice deve ritrovare il suo account premendo
     * «Microsoft», non un messaggio d'errore.** In università l'indirizzo è lo
     * stesso nei due casi, quindi succederà a quasi tutti.
     *
     * Better Auth collega da solo i due modi di entrare quando il provider
     * *dichiara* l'indirizzo come verificato. Google lo fa; Microsoft no, a
     * meno che chi amministra il dominio non abbia acceso la pretesa
     * facoltativa `email_verified` — quindi senza questa riga il collegamento
     * verrebbe rifiutato. Dichiararlo fidato è ragionevole: l'indirizzo di un
     * conto Microsoft non lo sceglie chi lo usa, lo assegna l'organizzazione o
     * lo verifica Microsoft.
     *
     * `allowDifferentEmails` resta spento, che è la parte che conta davvero:
     * si collegano solo account con **lo stesso** indirizzo.
     */
    accountLinking: {
      enabled: true,
      trustedProviders: ["microsoft"],
    },
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
