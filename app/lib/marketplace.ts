/** Regole pure: i permessi dipendono dalla partecipazione, non soltanto dal ruolo. */
import type { AssetStatus } from "~/generated/prisma/enums";

export const PROPOSAL_LABELS = {
  DRAFT: "p2p.statusDraft",
  PENDING: "p2p.statusPending",
  APPROVED: "p2p.statusApproved",
  REJECTED: "p2p.statusRejected",
} as const satisfies Record<AssetStatus, string>;

export function requestCapabilities(
  user: { id: string; role: string },
  req: { userId: string; lenderId: string | null },
) {
  const borrower = user.id === req.userId;
  const lender = user.id === req.lenderId;
  const admin = user.role === "ADMIN";
  return {
    borrower,
    lender,
    admin,
    read: borrower || lender || admin,
    manage: lender || (admin && !borrower),
    edit: borrower || (admin && !lender),
    seen: borrower
      ? ("userSeenAt" as const)
      : lender
        ? ("lenderSeenAt" as const)
        : ("adminSeenAt" as const),
  };
}

export function groupByLender<T extends { ownerId: string | null }>(
  assets: T[],
): Array<{ lenderId: string | null; assets: T[] }> {
  const groups = new Map<string | null, T[]>();
  for (const asset of assets)
    groups.set(asset.ownerId, [...(groups.get(asset.ownerId) ?? []), asset]);
  return [...groups].map(([lenderId, assets]) => ({ lenderId, assets }));
}

export type CartItemInput = { assetId: string; fromKitId?: string };
export function parseCartItems(value: string): CartItemInput[] | null {
  try {
    const data: unknown = JSON.parse(value);
    if (!Array.isArray(data) || data.length > 100) return null;
    const items = new Map<string, CartItemInput>();
    for (const entry of data) {
      if (
        !entry ||
        typeof entry !== "object" ||
        !("assetId" in entry) ||
        typeof entry.assetId !== "string" ||
        !entry.assetId ||
        entry.assetId.length > 100
      )
        return null;
      const fromKitId =
        "fromKitId" in entry && typeof entry.fromKitId === "string"
          ? entry.fromKitId
          : undefined;
      if (!items.has(entry.assetId))
        items.set(entry.assetId, { assetId: entry.assetId, fromKitId });
    }
    return [...items.values()].sort((a, b) =>
      a.assetId.localeCompare(b.assetId),
    );
  } catch {
    return null;
  }
}

export function submissionContent(
  items: CartItemInput[],
  from: string,
  to: string,
  purpose: string,
) {
  return JSON.stringify({
    items: [...items].sort((a, b) => a.assetId.localeCompare(b.assetId)),
    from,
    to,
    purpose: purpose.trim(),
  });
}

export function canEditProposal(status: AssetStatus) {
  return status === "DRAFT" || status === "REJECTED";
}
