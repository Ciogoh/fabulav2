/** Elenchi privati e indicatore non letto, sempre limitati al loro pubblico. */
import { Prisma } from "~/generated/prisma/client";
import { db } from "~/lib/db.server";
import { PERSON_SELECT } from "~/lib/asset-proposals.server";
import type { CurrentUser } from "~/lib/session.server";
import { PROPOSAL_LABELS } from "~/lib/marketplace";

export async function proposalList(
  user: CurrentUser,
  url: URL,
  moderator = false,
) {
  const raw = url.searchParams.get("status") ?? (moderator ? "PENDING" : "all");
  const status =
    raw in PROPOSAL_LABELS ? (raw as keyof typeof PROPOSAL_LABELS) : "all";
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const unread = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT a."id" FROM "Asset" a
    WHERE ${moderator ? Prisma.sql`a."ownerId" IS NOT NULL` : Prisma.sql`a."ownerId" = ${user.id}`}
    AND EXISTS (SELECT 1 FROM "AssetMessage" m WHERE m."assetId" = a."id"
      AND ${moderator ? Prisma.sql`m."authorId" <> ${user.id} AND (a."ownerId" = ${user.id} OR m."authorId" = a."ownerId")` : Prisma.sql`m."authorId" <> ${user.id}`}
      AND (${moderator ? Prisma.sql`CASE WHEN a."ownerId" = ${user.id} THEN a."ownerSeenAt" ELSE a."moderatorSeenAt" END` : Prisma.sql`a."ownerSeenAt"`} IS NULL
       OR m."createdAt" > ${moderator ? Prisma.sql`CASE WHEN a."ownerId" = ${user.id} THEN a."ownerSeenAt" ELSE a."moderatorSeenAt" END` : Prisma.sql`a."ownerSeenAt"`}))`);
  const ids = new Set(unread.map((r) => r.id));
  const assets = await db.asset.findMany({
    where: {
      ownerId: moderator ? { not: null } : user.id,
      ...(status !== "all" ? { status } : {}),
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    orderBy: moderator
      ? [{ submittedAt: "asc" }, { createdAt: "asc" }]
      : { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      isBookable: true,
      archivedAt: true,
      submittedAt: true,
      owner: moderator ? { select: PERSON_SELECT } : false,
      photos: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { thumbUrl: true },
      },
    },
  });
  return {
    assets: assets.map((a) => ({ ...a, unread: ids.has(a.id) })),
    status,
    query,
    moderator,
  };
}
