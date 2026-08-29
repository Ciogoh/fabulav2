import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { getLang } from "~/i18n/lang.server";
import { getTheme } from "~/lib/theme.server";
import { LangProvider } from "~/i18n/use-t";
import { SiteHeader } from "~/components/site-header";
import { getUser } from "~/lib/session.server";
import { startReminderScheduler } from "~/lib/reminders.server";
import { adminCounts, unreadForUserIds } from "~/lib/inbox.server";
import { PageShell } from "~/components/page";
import { ButtonLink } from "~/components/button";
import { versionLabel } from "~/lib/version";
import { PwaRuntime } from "~/components/pwa";

export const links: Route.LinksFunction = () => [
  /* Il guscio installabile. Il manifesto dice al browser come si chiama
     l'app, di che colore è la finestra e quali icone usare; senza, «Aggiungi
     alla schermata Home» produce un segnalibro con uno screenshot dentro,
     non un'applicazione. */
  { rel: "manifest", href: "/manifest.webmanifest" },
  /* iOS il manifesto lo legge solo a metà e le icone le prende da qui.
     Il file è opaco di proposito: un PNG con canale alfa, su iOS, non
     diventa trasparente — diventa nero. */
  { rel: "apple-touch-icon", href: "/icons/apple-touch-icon-180.png" },
  { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
  { rel: "icon", href: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Spectral:wght@400;600&display=swap",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  // Parte una volta sola per processo (guardia interna su `globalThis`) —
  // qui perché il loader radice gira a ogni richiesta, ed è l'unico punto
  // sicuramente lato server di questo modulo universale.
  startReminderScheduler();

  const user = await getUser(request);
  const isAdmin = user?.role === "ADMIN";

  /* Le tre voci del Centro in un colpo solo, e **solo per gli admin**: chi
     guarda il catalogo da anonimo non paga niente di tutto questo a ogni
     pagina. Il conto delle interrogazioni resta quello di prima — due —
     perché attesa e messaggi non letti viaggiano insieme (`inbox.server.ts`). */
  const inbox = isAdmin ? await adminCounts() : undefined;

  /* Una in più per chi ha fatto l'accesso, admin o no: è il segnale che a chi
     chiede in prestito è sempre mancato — «ti hanno risposto». È indicizzata
     su `userId` e riguarda solo le proprie richieste. */
  const myUnreadCount = user ? (await unreadForUserIds(user.id)).length : 0;

  return {
    // La preferenza salvata sul profilo vince sul cookie: chi entra da un
    // computer nuovo ritrova la sua lingua senza doverla riscegliere.
    lang: getLang(request, user?.language),
    // Letto qui e non nel browser: `data-theme` deve essere già dentro
    // all'HTML che parte, o chi apre Fabula al buio si prende un lampo
    // bianco a ogni caricamento. Vedi `lib/theme.server.ts`.
    theme: getTheme(request),
    user: user && {
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      alias: user.alias,
      image: user.image,
      email: user.email,
      isAdmin,
      inbox,
      myUnreadCount,
    },
  };
}

/**
 * Intestazioni di sicurezza su ogni pagina.
 *
 * Vivono sulla rotta radice: React Router le fa risalire da qui a ogni rotta
 * figlia che non ne dichiari di proprie, quindi non vanno ripetute.
 *
 * Manca una `Content-Security-Policy` completa, e non per dimenticanza:
 * React Router inserisce nella pagina uno script in linea con i dati dei
 * loader, quindi una politica seria richiede i «nonce» a ogni risposta.
 * `frame-ancestors` invece è la parte che serve davvero contro il clickjacking
 * e non rompe niente.
 */
export function headers(): HeadersInit {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "frame-ancestors 'none'",
    // `camera=(self)` e non `camera=()`: la lista vuota vuol dire «nessuna
    // origine, noi compresi», e finché è stata lì lo scanner QR non poteva
    // funzionare in nessun browser. Il sintomo era crudele — la fotocamera
    // non veniva mai chiesta, e darle il permesso a mano nelle impostazioni
    // non cambiava niente, perché la decisione era già presa da questa riga
    // prima ancora che il browser pensasse di domandare.
    // Le altre restano vuote: Fabula non usa microfono, posizione né
    // pagamenti, e ciò che non serve resta spento.
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=(), payment=()",
    // Un anno di HTTPS obbligatorio. Solo in produzione: in sviluppo
    // inchioderebbe `localhost` su HTTPS nel browser, per mesi.
    ...(process.env.NODE_ENV === "production"
      ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" }
      : {}),
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  // La lingua vera dell'interfaccia, non "en" fisso: un lettore di schermo
  // legge l'attributo `lang` per scegliere la voce, e leggeva l'italiano con
  // la pronuncia inglese. `useRouteLoaderData` e non le props perché `Layout`
  // avvolge anche l'`ErrorBoundary`, dove il loader può non aver girato.
  const data = useRouteLoaderData<typeof loader>("root");

  /* «auto» non mette nessun attributo: in `app.css` l'automatico *è*
     l'assenza di `data-theme`, e un `data-theme="auto"` sarebbe un terzo caso
     da tenere allineato senza che nessuna regola lo guardi. */
  const theme = data?.theme ?? "auto";

  return (
    <html lang={data?.lang ?? "en"} data-theme={theme === "auto" ? undefined : theme}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* Il colore della barra di sistema quando Fabula gira come app. I
            valori sono `--card` dei due temi, presi da `app.css` — la barra
            deve continuare l'intestazione, non annunciarsi.

            Finché il tema è automatico sono due righe e non una, perché il
            manifesto ne accetta un solo valore e sarebbe per forza sbagliato
            per metà delle persone. Quando invece la scelta è stata fatta, le
            due righe con la media query direbbero il contrario di quello che
            si vede: chi tiene il telefono in chiaro e Fabula in scuro si
            ritroverebbe la barra bianca sopra a una pagina nera. Lì ne serve
            una sola, e senza media query. */}
        {theme === "auto" ? (
          <>
            <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
            <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#161b24" />
          </>
        ) : (
          <meta name="theme-color" content={theme === "dark" ? "#161b24" : "#ffffff"} />
        )}

        {/* Quello che iOS legge al posto del manifesto. Il nome corto conta:
            senza, sotto all'icona finisce il `<title>` della pagina da cui è
            stata aggiunta, che di solito è lungo il doppio dello spazio. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Fabula" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  const user = loaderData.user;

  /* Il numero sul pallino dell'icona è **lo stesso** che il Centro mostra
     nell'intestazione, non un conto suo. Due numeri diversi per la stessa
     cosa — uno fuori sull'icona, uno dentro nella pagina — si contraddicono a
     vicenda, e a quel punto non si crede più a nessuno dei due. */
  const badgeCount = user?.inbox
    ? user.inbox.pending + user.inbox.unread + user.inbox.overdue
    : (user?.myUnreadCount ?? 0);

  return (
    <LangProvider lang={loaderData.lang}>
      <PwaRuntime badgeCount={badgeCount} />
      <SiteHeader user={user ?? null} />
      <Outlet />
    </LangProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  // L'intestazione va disegnata anche qui. Senza, una pagina inesistente
  // lasciava un piccolo collegamento "Fabula" come unica via d'uscita: chi ci
  // finiva dal segnalibro sbagliato non aveva il catalogo né il calendario.
  const data = useRouteLoaderData<typeof loader>("root");

  let heading = "Something went wrong";
  let detail = "Try again, or go back to the catalogue.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    heading = error.status === 404 ? "Page not found" : `Error ${error.status}`;
    detail =
      error.status === 404
        ? "That page does not exist."
        : error.statusText || detail;
  } else if (import.meta.env.DEV && error instanceof Error) {
    // In sviluppo l'errore vero si vede a schermo: nascondere lo stack dietro
    // un messaggio generico è ciò che rendeva impossibile capire i guasti
    // sulla vecchia piattaforma.
    detail = error.message;
    stack = error.stack;
  }

  return (
    <LangProvider lang={data?.lang ?? "en"}>
      <SiteHeader user={data?.user ?? null} />
      <main>
        <PageShell width="narrow" className="pb-24 pt-16">
          <h1 className="font-serif text-3xl font-semibold">{heading}</h1>
          <p className="mt-3 text-muted">{detail}</p>
          <ButtonLink to="/" variant="secondary" className="mt-8">
            {"\u2190 "}
            Fabula
          </ButtonLink>
          {stack && (
            <pre className="mt-8 overflow-x-auto rounded border border-rule bg-card p-4 font-mono text-xs">
              <code>{stack}</code>
            </pre>
          )}

          {/* Quando qualcosa si rompe, sapere quale copia l'ha fatto vale più
              che in qualunque altra schermata: è la prima domanda di chi
              riceve una segnalazione. */}
          <p className="mt-10 font-mono text-2xs text-muted">{versionLabel()}</p>
        </PageShell>
      </main>
    </LangProvider>
  );
}
