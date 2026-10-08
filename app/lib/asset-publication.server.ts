/** Il criterio unico con cui una scheda entra nelle superfici pubbliche. */
export const PUBLISHED_ASSET = {
  status: "APPROVED",
  archivedAt: null,
} as const;
export const INSTITUTIONAL_ASSET = {
  ...PUBLISHED_ASSET,
  ownerId: null,
} as const;
