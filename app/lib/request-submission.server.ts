/** Il carrello diventa un lotto atomico, con una pratica per prestatore. */
import { createHash } from "node:crypto";
import { Prisma } from "~/generated/prisma/client";
import { db } from "~/lib/db.server";
import { PUBLISHED_ASSET } from "~/lib/asset-publication.server";
import { getBusyAssetIds, formatDay } from "~/lib/availability.server";
import {
  groupByLender,
  submissionContent,
  type CartItemInput,
} from "~/lib/marketplace";
import { lockAssets } from "~/lib/request-locks.server";
import type { TranslationKey } from "~/i18n/dictionaries";

export class SubmissionError extends Error {
  constructor(
    public key: TranslationKey,
    public conflicts: string[] = [],
  ) {
    super(key);
  }
}

export async function submitRequestBatch(input: {
  userId: string;
  submissionKey: string;
  items: CartItemInput[];
  from: Date;
  to: Date;
  purpose: string;
}) {
  const fingerprint = createHash("sha256")
    .update(
      submissionContent(
        input.items,
        formatDay(input.from),
        formatDay(input.to),
        input.purpose,
      ),
    )
    .digest("hex");
  const unique = {
    userId_submissionKey: {
      userId: input.userId,
      submissionKey: input.submissionKey,
    },
  };
  const existing = async () =>
    db.requestBatch.findUnique({
      where: unique,
      select: {
        id: true,
        fingerprint: true,
        requests: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            lenderId: true,
            items: { select: { asset: { select: { name: true } } } },
          },
        },
      },
    });
  const reuse = (batch: NonNullable<Awaited<ReturnType<typeof existing>>>) => {
    if (batch.fingerprint !== fingerprint)
      throw new SubmissionError("p2p.errorRetry");
    return { batchId: batch.id, requests: batch.requests, reused: true };
  };
  const found = await existing();
  if (found) return reuse(found);
  try {
    return await db.$transaction(async (tx) => {
      const ids = input.items.map((i) => i.assetId);
      await lockAssets(tx, ids);
      const assets = await tx.asset.findMany({
        where: { id: { in: ids }, ...PUBLISHED_ASSET },
        select: { id: true, name: true, ownerId: true, isBookable: true },
      });
      if (assets.length !== ids.length || assets.some((a) => !a.isBookable))
        throw new SubmissionError("request.errorUnavailable");
      if (assets.some((a) => a.ownerId === input.userId))
        throw new SubmissionError("p2p.errorSelfLoan");
      const kitItems = input.items.filter((i) => i.fromKitId);
      if (kitItems.length) {
        const membership = await tx.kitAsset.findMany({
          where: {
            OR: kitItems.map((i) => ({
              kitId: i.fromKitId!,
              assetId: i.assetId,
            })),
          },
          select: { kitId: true, assetId: true },
        });
        if (
          kitItems.some(
            (i) =>
              !membership.some(
                (m) => m.kitId === i.fromKitId && m.assetId === i.assetId,
              ),
          )
        )
          throw new SubmissionError("request.errorUnavailable");
      }
      const busy = await getBusyAssetIds(input.from, input.to, { tx });
      const conflicts = assets.filter((a) => busy.has(a.id)).map((a) => a.name);
      if (conflicts.length)
        throw new SubmissionError("request.errorConflict", conflicts);
      const batch = await tx.requestBatch.create({
        data: {
          userId: input.userId,
          submissionKey: input.submissionKey,
          fingerprint,
        },
        select: { id: true },
      });
      const requests = [];
      for (const group of groupByLender(assets)) {
        const created = await tx.request.create({
          data: {
            userId: input.userId,
            lenderId: group.lenderId,
            batchId: batch.id,
            startDate: input.from,
            endDate: input.to,
            purpose: input.purpose || null,
            items: {
              create: group.assets.map((a) => ({
                assetId: a.id,
                fromKitId:
                  input.items.find((i) => i.assetId === a.id)?.fromKitId ??
                  null,
              })),
            },
          },
          select: {
            id: true,
            lenderId: true,
            items: { select: { asset: { select: { name: true } } } },
          },
        });
        requests.push(created);
      }
      return { batchId: batch.id, requests, reused: false };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await existing();
      if (raced) return reuse(raced);
    }
    throw error;
  }
}
