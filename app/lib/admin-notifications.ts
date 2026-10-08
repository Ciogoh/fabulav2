/**
 * Destinatari operativi, separati dai permessi e dagli avvisi personali.
 * Gli indirizzi aggiuntivi non devono aggirare uno switch spento: si
 * confrontano con TUTTI gli admin, non soltanto con quelli selezionati.
 * Funzione pura condivisa fra invio e riepilogo nella pagina Soci.
 */
export function selectAdminNotificationRecipients<
  T extends { email: string; receivesAdminNotifications: boolean },
>(admins: T[], configuredEmails: string): { people: T[]; extras: string[] } {
  const known = new Set(admins.map((admin) => admin.email.trim().toLowerCase()));
  const extras: string[] = [];
  for (const value of configuredEmails.split(",")) {
    const email = value.trim();
    const key = email.toLowerCase();
    if (!email || known.has(key)) continue;
    known.add(key);
    extras.push(email);
  }
  return {
    people: admins.filter((admin) => admin.receivesAdminNotifications),
    extras,
  };
}
