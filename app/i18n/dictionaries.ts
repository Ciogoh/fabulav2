/**
 * Le tre lingue dell'interfaccia.
 *
 * Niente libreria: con tre lingue e chiavi piatte un oggetto basta, e in più
 * TypeScript segnala da solo una chiave mancante o scritta male — cosa che la
 * maggior parte delle librerie di traduzione non fa.
 *
 * L'inglese è la lingua di riferimento: definisce le chiavi, le altre devono
 * combaciare o il controllo dei tipi fallisce.
 *
 * I nomi degli oggetti in catalogo NON si traducono: restano come sono stati
 * scritti dagli admin.
 */

export const LANGUAGES = ["en", "it", "de"] as const;
export type Lang = (typeof LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<Lang, string> = {
  en: "English",
  it: "Italiano",
  de: "Deutsch",
};

const en = {
  "app.name": "Fabula",
  "app.tagline": "What the association owns, and when you can borrow it.",

  "nav.catalogue": "Catalogue",
  "nav.myRequests": "My requests",
  "nav.signIn": "Sign in",
  "nav.language": "Language",

  "catalogue.heading": "Catalogue",
  "catalogue.from": "From",
  "catalogue.to": "Until",
  "catalogue.checkDates": "Check dates",
  "catalogue.clearDates": "Clear",
  "catalogue.datesHint": "Pick two dates to see what is free in that period.",
  "catalogue.allCategories": "All categories",
  "catalogue.showingAll": "{count} items",
  "catalogue.showingFree": "{count} of {total} free from {from} to {to}",
  "catalogue.empty": "Nothing matches. Try a wider period or another category.",
  "catalogue.endBeforeStart": "The end date comes before the start date.",

  "state.free": "Free",
  "state.reserved": "Reserved",
  "state.inUse": "In use",
  "state.unavailable": "Not available",
  "state.backOn": "Back on {date}",
  "state.fromDate": "From {date}",
  "state.notBookable": "Not lendable",

  "kit.badge": "Kit",
  "kit.itemCount": "{count} items",
  "kit.contains": "Contains",

  "cart.add": "Add",
  "cart.added": "Added",
  "cart.remove": "Remove",
  "cart.heading": "Your request",
  "cart.empty": "Nothing selected yet.",
  "cart.itemCount": "{count} selected",
  "cart.clear": "Clear",
  "cart.submit": "Request these dates",
  "cart.needDates": "Pick your dates first.",

  "nav.signOut": "Sign out",

  "signin.heading": "Sign in",
  "signin.intro": "We send you a code. No password to remember.",
  "signin.newHere": "First time? Ask for a code — the account is created on the spot.",
  "signin.email": "Email",
  "signin.sendCode": "Send me a code",
  "signin.sending": "Sending…",
  "signin.codeSentTo": "Code sent to {email}. It lasts ten minutes.",
  "signin.code": "Code",
  "signin.verify": "Sign in",
  "signin.checking": "Checking…",
  "signin.resend": "Send another",
  "signin.otherEmail": "Use another address",
  "signin.google": "Continue with Google",
  "signin.or": "or",
  "signin.havePassword": "I have a password",
  "signin.useCode": "Use a code instead",
  "signin.password": "Password",
  "signin.failed": "That did not work. Check the address and try again.",
  "signin.badCode": "Wrong or expired code.",
  "signin.badPassword": "Wrong email or password.",

  "welcome.heading": "One last thing",
  "welcome.intro": "What should we call you? The admins see this name on your requests.",
  "welcome.name": "Your name",
  "welcome.save": "Continue",
  "welcome.nameRequired": "Write your name to continue.",

  "nav.calendar": "Calendar",

  "calendar.heading": "Calendar",
  "calendar.intro": "When each item is taken. Add it to your own calendar with the link below.",
  "calendar.today": "Today",
  "calendar.previous": "Earlier",
  "calendar.next": "Later",
  "calendar.showAll": "Show every item",
  "calendar.showBusy": "Only items with bookings",
  "calendar.empty": "Nothing booked in this period.",
  "calendar.subscribe": "Add to your calendar",
  "calendar.subscribeHint": "Paste this address into Google Calendar, Apple Calendar or Outlook. It shows what is taken and when — never who has it.",
  "calendar.copy": "Copy link",
  "calendar.copied": "Copied",

  "state.requested": "Requested",
} as const;

export type TranslationKey = keyof typeof en;
type Dictionary = Record<TranslationKey, string>;

const it: Dictionary = {
  "app.name": "Fabula",
  "app.tagline": "Cosa ha l'associazione, e quando puoi prenderlo in prestito.",

  "nav.catalogue": "Catalogo",
  "nav.myRequests": "Le mie richieste",
  "nav.signIn": "Entra",
  "nav.language": "Lingua",

  "catalogue.heading": "Catalogo",
  "catalogue.from": "Dal",
  "catalogue.to": "Al",
  "catalogue.checkDates": "Verifica le date",
  "catalogue.clearDates": "Azzera",
  "catalogue.datesHint": "Scegli due date per vedere cosa è libero in quel periodo.",
  "catalogue.allCategories": "Tutte le categorie",
  "catalogue.showingAll": "{count} oggetti",
  "catalogue.showingFree": "{count} liberi su {total} dal {from} al {to}",
  "catalogue.empty": "Nessun risultato. Prova con un periodo più ampio o un'altra categoria.",
  "catalogue.endBeforeStart": "La data di fine viene prima di quella di inizio.",

  "state.free": "Libero",
  "state.reserved": "Prenotato",
  "state.inUse": "In uso",
  "state.unavailable": "Non disponibile",
  "state.backOn": "Torna il {date}",
  "state.fromDate": "Dal {date}",
  "state.notBookable": "Non prestabile",

  "kit.badge": "Kit",
  "kit.itemCount": "{count} oggetti",
  "kit.contains": "Contiene",

  "cart.add": "Aggiungi",
  "cart.added": "Aggiunto",
  "cart.remove": "Togli",
  "cart.heading": "La tua richiesta",
  "cart.empty": "Non hai ancora scelto niente.",
  "cart.itemCount": "{count} selezionati",
  "cart.clear": "Svuota",
  "cart.submit": "Richiedi queste date",
  "cart.needDates": "Scegli prima le date.",

  "nav.signOut": "Esci",

  "signin.heading": "Entra",
  "signin.intro": "Ti mandiamo un codice. Nessuna password da ricordare.",
  "signin.newHere": "Prima volta? Chiedi un codice: l'account si crea al momento.",
  "signin.email": "Email",
  "signin.sendCode": "Mandami un codice",
  "signin.sending": "Invio…",
  "signin.codeSentTo": "Codice mandato a {email}. Vale dieci minuti.",
  "signin.code": "Codice",
  "signin.verify": "Entra",
  "signin.checking": "Verifica…",
  "signin.resend": "Mandane un altro",
  "signin.otherEmail": "Usa un altro indirizzo",
  "signin.google": "Continua con Google",
  "signin.or": "oppure",
  "signin.havePassword": "Ho una password",
  "signin.useCode": "Usa invece un codice",
  "signin.password": "Password",
  "signin.failed": "Non ha funzionato. Controlla l'indirizzo e riprova.",
  "signin.badCode": "Codice sbagliato o scaduto.",
  "signin.badPassword": "Email o password sbagliate.",

  "welcome.heading": "Un'ultima cosa",
  "welcome.intro": "Come ti chiami? Gli admin vedono questo nome sulle tue richieste.",
  "welcome.name": "Il tuo nome",
  "welcome.save": "Continua",
  "welcome.nameRequired": "Scrivi il tuo nome per continuare.",

  "nav.calendar": "Calendario",

  "calendar.heading": "Calendario",
  "calendar.intro": "Quando ogni oggetto è occupato. Con il collegamento qui sotto lo aggiungi al tuo calendario.",
  "calendar.today": "Oggi",
  "calendar.previous": "Prima",
  "calendar.next": "Dopo",
  "calendar.showAll": "Mostra tutti gli oggetti",
  "calendar.showBusy": "Solo oggetti con prenotazioni",
  "calendar.empty": "Niente di prenotato in questo periodo.",
  "calendar.subscribe": "Aggiungi al tuo calendario",
  "calendar.subscribeHint": "Incolla questo indirizzo in Google Calendar, Calendario di Apple o Outlook. Mostra cosa è occupato e quando — mai chi ce l'ha.",
  "calendar.copy": "Copia il collegamento",
  "calendar.copied": "Copiato",

  "state.requested": "Richiesto",
};

const de: Dictionary = {
  "app.name": "Fabula",
  "app.tagline": "Was der Verein besitzt und wann du es ausleihen kannst.",

  "nav.catalogue": "Katalog",
  "nav.myRequests": "Meine Anfragen",
  "nav.signIn": "Anmelden",
  "nav.language": "Sprache",

  "catalogue.heading": "Katalog",
  "catalogue.from": "Von",
  "catalogue.to": "Bis",
  "catalogue.checkDates": "Zeitraum prüfen",
  "catalogue.clearDates": "Zurücksetzen",
  "catalogue.datesHint": "Wähle zwei Daten, um zu sehen, was in diesem Zeitraum frei ist.",
  "catalogue.allCategories": "Alle Kategorien",
  "catalogue.showingAll": "{count} Gegenstände",
  "catalogue.showingFree": "{count} von {total} frei vom {from} bis {to}",
  "catalogue.empty": "Keine Treffer. Versuche einen längeren Zeitraum oder eine andere Kategorie.",
  "catalogue.endBeforeStart": "Das Enddatum liegt vor dem Startdatum.",

  "state.free": "Frei",
  "state.reserved": "Reserviert",
  "state.inUse": "Verliehen",
  "state.unavailable": "Nicht verfügbar",
  "state.backOn": "Zurück am {date}",
  "state.fromDate": "Ab {date}",
  "state.notBookable": "Nicht ausleihbar",

  "kit.badge": "Set",
  "kit.itemCount": "{count} Gegenstände",
  "kit.contains": "Enthält",

  "cart.add": "Hinzufügen",
  "cart.added": "Hinzugefügt",
  "cart.remove": "Entfernen",
  "cart.heading": "Deine Anfrage",
  "cart.empty": "Noch nichts ausgewählt.",
  "cart.itemCount": "{count} ausgewählt",
  "cart.clear": "Leeren",
  "cart.submit": "Diesen Zeitraum anfragen",
  "cart.needDates": "Wähle zuerst die Daten.",

  "nav.signOut": "Abmelden",

  "signin.heading": "Anmelden",
  "signin.intro": "Wir schicken dir einen Code. Kein Passwort zum Merken.",
  "signin.newHere": "Zum ersten Mal hier? Fordere einen Code an — das Konto entsteht sofort.",
  "signin.email": "E-Mail",
  "signin.sendCode": "Code schicken",
  "signin.sending": "Wird geschickt…",
  "signin.codeSentTo": "Code an {email} geschickt. Er gilt zehn Minuten.",
  "signin.code": "Code",
  "signin.verify": "Anmelden",
  "signin.checking": "Wird geprüft…",
  "signin.resend": "Neuen Code schicken",
  "signin.otherEmail": "Andere Adresse benutzen",
  "signin.google": "Weiter mit Google",
  "signin.or": "oder",
  "signin.havePassword": "Ich habe ein Passwort",
  "signin.useCode": "Lieber einen Code",
  "signin.password": "Passwort",
  "signin.failed": "Hat nicht geklappt. Prüfe die Adresse und versuche es nochmal.",
  "signin.badCode": "Code falsch oder abgelaufen.",
  "signin.badPassword": "E-Mail oder Passwort falsch.",

  "welcome.heading": "Noch eine Sache",
  "welcome.intro": "Wie heißt du? Die Admins sehen diesen Namen bei deinen Anfragen.",
  "welcome.name": "Dein Name",
  "welcome.save": "Weiter",
  "welcome.nameRequired": "Schreibe deinen Namen, um fortzufahren.",

  "nav.calendar": "Kalender",

  "calendar.heading": "Kalender",
  "calendar.intro": "Wann welcher Gegenstand belegt ist. Mit dem Link unten fügst du ihn deinem Kalender hinzu.",
  "calendar.today": "Heute",
  "calendar.previous": "Früher",
  "calendar.next": "Später",
  "calendar.showAll": "Alle Gegenstände zeigen",
  "calendar.showBusy": "Nur Gegenstände mit Buchungen",
  "calendar.empty": "In diesem Zeitraum ist nichts gebucht.",
  "calendar.subscribe": "Zu deinem Kalender hinzufügen",
  "calendar.subscribeHint": "Füge diese Adresse in Google Kalender, Apple Kalender oder Outlook ein. Sie zeigt, was belegt ist und wann — nie, wer es hat.",
  "calendar.copy": "Link kopieren",
  "calendar.copied": "Kopiert",

  "state.requested": "Angefragt",
};

export const dictionaries: Record<Lang, Dictionary> = { en, it, de };

/** Traduce una chiave, sostituendo i segnaposto `{nome}`. */
export function translate(
  lang: Lang,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  const text = dictionaries[lang][key];
  if (!params) return text;

  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && LANGUAGES.includes(value as Lang);
}
