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
import { LangProvider } from "~/i18n/use-t";
import { SiteHeader } from "~/components/site-header";
import { getUser } from "~/lib/session.server";
import { db } from "~/lib/db.server";
import { startReminderScheduler } from "~/lib/reminders.server";
import { PageShell } from "~/components/page";
import { ButtonLink } from "~/components/button";

export const links: Route.LinksFunction = () => [
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

  // Solo per gli admin: chi guarda il catalogo da anonimo non paga questa
  // query in più a ogni pagina.
  const pendingCount = isAdmin
    ? await db.request.count({ where: { status: "PENDING" } })
    : undefined;

  return {
    // La preferenza salvata sul profilo vince sul cookie: chi entra da un
    // computer nuovo ritrova la sua lingua senza doverla riscegliere.
    lang: getLang(request, user?.language),
    user: user && {
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      alias: user.alias,
      image: user.image,
      email: user.email,
      isAdmin,
      pendingCount,
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
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
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

  return (
    <html lang={data?.lang ?? "en"}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
  return (
    <LangProvider lang={loaderData.lang}>
      <SiteHeader user={loaderData.user ?? null} />
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
        </PageShell>
      </main>
    </LangProvider>
  );
}
