-- La scelta dei destinatari è indipendente dai permessi amministrativi.
ALTER TABLE "User" ADD COLUMN "receivesAdminNotifications" BOOLEAN NOT NULL DEFAULT false;

-- Conservare gli avvisi esistenti finché gli admin non scelgono chi escludere.
UPDATE "User" SET "receivesAdminNotifications" = true WHERE "role" = 'ADMIN';
