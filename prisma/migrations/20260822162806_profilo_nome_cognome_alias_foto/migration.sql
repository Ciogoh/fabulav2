-- AlterTable
ALTER TABLE "User" ADD COLUMN     "alias" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT;

-- Gli account che esistevano prima hanno solo `name`. Lo spezziamo sul primo
-- spazio: "Dario Vedova" diventa Dario + Vedova, "Samu" resta Samu senza
-- cognome, "Anna Maria De Luca" diventa Anna + "Maria De Luca". Non è una
-- regola perfetta per tutti i nomi del mondo, ma è meglio di due colonne
-- vuote, e dal profilo si corregge in dieci secondi.
UPDATE "User" SET
  "firstName" = CASE
    WHEN position(' ' in btrim("name")) > 0 THEN split_part(btrim("name"), ' ', 1)
    ELSE btrim("name")
  END,
  "lastName" = CASE
    WHEN position(' ' in btrim("name")) > 0
      THEN btrim(substring(btrim("name") from position(' ' in btrim("name")) + 1))
    ELSE NULL
  END
WHERE btrim("name") <> '';
