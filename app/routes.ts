import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/catalogue.tsx"),
  route("items/:id", "routes/item.tsx"),
  route("calendar", "routes/calendar.tsx"),
  // Il punto nel nome è letterale, non un separatore di segmenti.
  route("calendar.ics", "routes/calendar[.]ics.tsx"),
  route("signin", "routes/signin.tsx"),
  route("welcome", "routes/welcome.tsx"),
  route("language", "routes/language.tsx"),
  route("account", "routes/account.tsx"),
  route("requests", "routes/requests.tsx"),
  // Sole risorse: il foglio della richiesta chiede da qui se gli oggetti
  // scelti sono liberi nelle date scelte, mentre le si sceglie.
  route("availability", "routes/availability.tsx"),
  route("requests/:id", "routes/request-detail.tsx"),
  // Il Centro: tutto quello che aspetta un admin in una schermata sola. Le due
  // rotte qui sotto ci rimandano con `?vista=`, perché un segnalibro non deve
  // smettere di funzionare per una riorganizzazione nostra.
  route("admin", "routes/admin.tsx"),
  route("admin/members", "routes/admin.members.tsx"),
  route("admin/requests", "routes/admin.requests.tsx"),
  route("admin/overdue", "routes/admin.overdue.tsx"),
  route("admin/assets", "routes/admin.assets.tsx"),
  route("admin/assets/new", "routes/admin.assets.new.tsx"),
  route("admin/assets/:id", "routes/admin.assets.$id.tsx"),
  route("admin/kits", "routes/admin.kits.tsx"),
  route("admin/kits/new", "routes/admin.kits.new.tsx"),
  route("admin/kits/:id", "routes/admin.kits.$id.tsx"),
  route("admin/categories", "routes/admin.categories.tsx"),
  route("admin/log", "routes/admin.log.tsx"),
  // Lo scanner e la consegna che ne segue: l'indirizzo qui sotto è quello
  // stampato dentro al QR di ogni oggetto, quindi non si cambia a cuor
  // leggero — gli adesivi già attaccati continuerebbero a puntare qui.
  route("admin/scan", "routes/admin.scan.tsx"),
  route("admin/handover/:assetId", "routes/admin.handover.$assetId.tsx"),
  // L'indirizzo corto che sta dentro agli adesivi. Corto **per forza**: ogni
  // carattere in meno è un modulo in meno nel QR, cioè un modulo più grande a
  // parità di carta. Rimanda alla consegna qui sopra.
  route("h/:code", "routes/h.$code.tsx"),
  route("reset-password", "routes/reset-password.tsx"),
  route("uploads/*", "routes/uploads.tsx"),
  // Chi tiene su la piattaforma chiede qui se è viva: Coolify per decidere se
  // il container nuovo può prendere il traffico, il tunnel per lo stesso.
  route("healthz", "routes/healthz.tsx"),
  // Tutto l'accesso passa da un solo gestore di Better Auth.
  route("api/auth/*", "routes/api.auth.$.tsx"),
] satisfies RouteConfig;
