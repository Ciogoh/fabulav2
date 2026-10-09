/** Proposte: transizioni, contenuti e permessi rimangono in un solo servizio. */
import { db } from "~/lib/db.server";
import type { CurrentUser } from "~/lib/session.server";
import { lockAssets } from "~/lib/request-locks.server";
import { canEditProposal } from "~/lib/marketplace";
import { saveAssetPhoto, deleteAssetPhotoFiles } from "~/lib/uploads.server";
import { publishProposalChange } from "~/lib/events.server";
import { logAdminAction } from "~/lib/audit.server";
import {
  notifyProposalSubmitted,
  notifyProposalDecision,
  notifyConversation,
} from "~/lib/marketplace-notifications.server";
import type { TranslationKey } from "~/i18n/dictionaries";

export const PERSON_SELECT = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  alias: true,
  image: true,
} as const;
const SELECT = {
  id: true,
  ownerId: true,
  name: true,
  description: true,
  categoryId: true,
  status: true,
  isBookable: true,
  archivedAt: true,
  submittedAt: true,
  reviewedAt: true,
  rejectionReason: true,
  updatedAt: true,
  ownerSeenAt: true,
  moderatorSeenAt: true,
  owner: { select: PERSON_SELECT },
  photos: {
    orderBy: { sortOrder: "asc" as const },
    select: { id: true, url: true, thumbUrl: true },
  },
  messages: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      authorId: true,
      body: true,
      createdAt: true,
      author: { select: { ...PERSON_SELECT, role: true } },
    },
  },
} as const;

/** I campi tornano al modulo anche se la versione letta nel frattempo è cambiata. */
export function proposalErrorValues(form: FormData) {
  if (
    !["saveDraft", "submit", "reviewSave"].includes(String(form.get("intent")))
  )
    return undefined;
  return {
    name: String(form.get("name") ?? ""),
    description: String(form.get("description") ?? ""),
    categoryId: String(form.get("categoryId") ?? ""),
  };
}

export class ProposalError extends Error {
  constructor(public key: TranslationKey) {
    super(key);
  }
}

export async function loadProposal(
  user: CurrentUser,
  id: string,
  moderator = false,
) {
  const asset = await db.asset.findUnique({ where: { id }, select: SELECT });
  if (
    !asset?.ownerId ||
    (asset.ownerId !== user.id && !(moderator && user.role === "ADMIN"))
  )
    throw new Response("Not found", { status: 404 });
  return asset;
}

export async function proposalPage(
  user: CurrentUser,
  id: string,
  moderator = false,
) {
  const asset = await loadProposal(user, id, moderator);
  const last = asset.messages.at(-1);
  const field =
    moderator && asset.ownerId !== user.id ? "moderatorSeenAt" : "ownerSeenAt";
  if (last && (!asset[field] || last.createdAt > asset[field]))
    await db.asset.updateMany({
      // Leggere la chat non cambia la revisione dei contenuti. Il confronto
      // protegge anche da una correzione avvenuta mentre caricavamo la pagina.
      where: { id, [field]: asset[field], updatedAt: asset.updatedAt },
      data: { [field]: last.createdAt, updatedAt: asset.updatedAt },
    });
  const [categories, loans] = await Promise.all([
    db.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    db.request.findMany({
      where: {
        items: { some: { assetId: id } },
        OR: [
          { status: "PENDING" },
          {
            status: "APPROVED",
            items: { some: { assetId: id, returnedAt: null } },
          },
        ],
      },
      orderBy: { startDate: "asc" },
      select: { id: true, startDate: true, endDate: true, status: true },
    }),
  ]);
  return {
    asset: {
      ...asset,
      messages: asset.messages.map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        author: m.author,
        authorIsAdmin: m.author.role === "ADMIN",
        isMine: m.authorId === user.id,
      })),
    },
    categories,
    loans,
    moderator,
  };
}

export async function saveProposal(
  user: CurrentUser,
  form: FormData,
  id?: string,
) {
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "")
    .trim()
    .slice(0, 5000);
  if (name.length < 2 || name.length > 120)
    throw new ProposalError("assets.errorName");
  const categoryId = String(form.get("categoryId") ?? "") || null;
  if (
    categoryId &&
    !(await db.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    }))
  )
    throw new ProposalError("p2p.errorCategory");
  const files = form
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > 12) throw new ProposalError("p2p.errorPhotos");
  const saved = await db.$transaction(async (tx) => {
    if (id) {
      await lockAssets(tx, [id]);
      const current = await tx.asset.findUnique({
        where: { id },
        select: {
          ownerId: true,
          status: true,
          updatedAt: true,
          archivedAt: true,
        },
      });
      if (!current || current.ownerId !== user.id)
        throw new Response("Not found", { status: 404 });
      if (
        !canEditProposal(current.status) ||
        current.archivedAt ||
        current.updatedAt.toISOString() !== String(form.get("version"))
      )
        throw new ProposalError("p2p.errorStale");
      return tx.asset.update({
        where: { id },
        data: {
          name,
          description: description || null,
          categoryId,
          status: "DRAFT",
          rejectionReason: null,
        },
        select: { id: true, updatedAt: true },
      });
    }
    return tx.asset.create({
      data: {
        ownerId: user.id,
        status: "DRAFT",
        name,
        description: description || null,
        categoryId,
      },
      select: { id: true, updatedAt: true },
    });
  });
  const prepared: Array<{ url: string; thumbUrl: string }> = [];
  let photoError = false;
  try {
    for (const file of files) {
      const result = await saveAssetPhoto(saved.id, file);
      if (!result.ok) {
        photoError = true;
        continue;
      }
      prepared.push(result);
    }
    await db.$transaction(async (tx) => {
      await lockAssets(tx, [saved.id]);
      const current = await tx.asset.findUnique({
        where: { id: saved.id },
        select: { status: true, updatedAt: true },
      });
      if (
        !current ||
        current.status !== "DRAFT" ||
        current.updatedAt.getTime() !== saved.updatedAt.getTime()
      )
        throw new ProposalError("p2p.errorStale");
      const count = await tx.assetPhoto.count({ where: { assetId: saved.id } });
      if (count + prepared.length > 12)
        throw new ProposalError("p2p.errorPhotos");
      await tx.assetPhoto.createMany({
        data: prepared.map((p, index) => ({
          assetId: saved.id,
          url: p.url,
          thumbUrl: p.thumbUrl,
          sortOrder: count + index,
        })),
      });
      if (!photoError && form.get("intent") === "submit")
        await tx.asset.update({
          where: { id: saved.id },
          data: {
            status: "PENDING",
            submittedAt: new Date(),
            reviewedAt: null,
            reviewedById: null,
            rejectionReason: null,
          },
        });
    });
  } catch (error) {
    await deleteAssetPhotoFiles(
      ...prepared.flatMap((p) => [p.url, p.thumbUrl]),
    );
    // Il testo è già salvo in bozza: la pagina di recupero evita duplicati e perdita del lavoro.
    console.error("Caricamento delle foto della proposta fallito:", error);
    photoError = true;
  }
  publishProposalChange(saved.id, user.id);
  if (!photoError && form.get("intent") === "submit") {
    await logAdminAction({
      actorId: user.id,
      action: "asset.proposed",
      targetType: "Asset",
      targetId: saved.id,
      detail: name,
    });
    await notifyProposalSubmitted(saved.id);
  }
  return {
    id: saved.id,
    photoError,
    submitted: !photoError && form.get("intent") === "submit",
  };
}

export async function proposalAction(
  user: CurrentUser,
  id: string,
  form: FormData,
  moderator = false,
) {
  const asset = await loadProposal(user, id, moderator);
  const intent = String(form.get("intent") ?? "");
  if (intent === "message") {
    const body = String(form.get("body") ?? "")
      .trim()
      .slice(0, 2000);
    if (!body) throw new ProposalError("request.errorMessageEmpty");
    const message = await db.assetMessage.create({
      data: { assetId: id, authorId: user.id, body },
      select: { id: true },
    });
    publishProposalChange(id, asset.ownerId!);
    await notifyConversation("proposal", id, user.id, message.id);
    return { ok: true as const, intent };
  }
  if ((intent === "saveDraft" || intent === "submit") && !moderator) {
    const result = await saveProposal(user, form, id);
    return { ok: true as const, intent, ...result };
  }
  const decision =
    intent === "approve" || intent === "reject" || intent === "reviewSave";
  if (decision && (!moderator || user.role !== "ADMIN"))
    throw new Response("Not found", { status: 404 });
  const reason = String(form.get("reason") ?? "")
    .trim()
    .slice(0, 2000);
  if (intent === "reject" && !reason)
    throw new ProposalError("p2p.errorReason");
  let deleted = false;
  await db.$transaction(async (tx) => {
    await lockAssets(tx, [id]);
    const current = await tx.asset.findUnique({
      where: { id },
      select: {
        status: true,
        updatedAt: true,
        isBookable: true,
        archivedAt: true,
      },
    });
    if (
      !current ||
      current.updatedAt.toISOString() !== String(form.get("version"))
    )
      throw new ProposalError("p2p.errorStale");
    if (current.archivedAt) throw new ProposalError("p2p.errorStale");
    if (decision) {
      if (current.status !== "PENDING")
        throw new ProposalError("p2p.errorStale");
      if (intent === "reviewSave") {
        const name = String(form.get("name") ?? "").trim();
        if (name.length < 2 || name.length > 120)
          throw new ProposalError("assets.errorName");
        const categoryId = String(form.get("categoryId") ?? "") || null;
        if (
          categoryId &&
          !(await tx.category.findUnique({
            where: { id: categoryId },
            select: { id: true },
          }))
        )
          throw new ProposalError("p2p.errorCategory");
        await tx.asset.update({
          where: { id },
          data: {
            name,
            description:
              String(form.get("description") ?? "")
                .trim()
                .slice(0, 5000) || null,
            categoryId,
          },
        });
      } else
        await tx.asset.update({
          where: { id },
          data: {
            status: intent === "approve" ? "APPROVED" : "REJECTED",
            reviewedAt: new Date(),
            reviewedById: user.id,
            rejectionReason: intent === "reject" ? reason : null,
          },
        });
    } else if (intent === "pause") {
      if (current.status !== "APPROVED")
        throw new ProposalError("p2p.errorStale");
      await tx.asset.update({
        where: { id },
        data: { isBookable: !current.isBookable },
      });
    } else if (intent === "withdraw" || intent === "archive") {
      const open = await tx.request.count({
        where: {
          items: { some: { assetId: id } },
          OR: [
            { status: "PENDING" },
            {
              status: "APPROVED",
              items: { some: { assetId: id, returnedAt: null } },
            },
          ],
        },
      });
      if (open) throw new ProposalError("p2p.errorActive");
      await tx.asset.update({
        where: { id },
        data:
          intent === "archive"
            ? { archivedAt: new Date() }
            : { status: "DRAFT", rejectionReason: null },
      });
      if (intent === "archive")
        await tx.kitAsset.deleteMany({ where: { assetId: id } });
    } else if (intent === "delete") {
      if (
        current.status === "APPROVED" ||
        (await tx.requestItem.count({ where: { assetId: id } }))
      )
        throw new ProposalError("p2p.errorActive");
      await tx.asset.delete({ where: { id } });
      deleted = true;
    } else if (intent === "deletePhoto" || intent === "setCover") {
      if (!canEditProposal(current.status))
        throw new ProposalError("p2p.errorStale");
      const photoId = String(form.get("photoId") ?? "");
      const photo = asset.photos.find((p) => p.id === photoId);
      if (!photo) throw new Response("Not found", { status: 404 });
      if (intent === "deletePhoto")
        await tx.assetPhoto.delete({ where: { id: photoId } });
      else {
        await tx.assetPhoto.updateMany({
          where: { assetId: id },
          data: { sortOrder: 1 },
        });
        await tx.assetPhoto.update({
          where: { id: photoId },
          data: { sortOrder: 0 },
        });
      }
      await tx.asset.update({ where: { id }, data: { updatedAt: new Date() } });
    } else throw new ProposalError("request.errorGeneric");
  });
  if (deleted)
    await deleteAssetPhotoFiles(
      ...asset.photos.flatMap((p) => [p.url, p.thumbUrl]),
    );
  if (intent === "deletePhoto") {
    const photo = asset.photos.find(
      (p) => p.id === String(form.get("photoId")),
    );
    if (photo) await deleteAssetPhotoFiles(photo.url, photo.thumbUrl);
  }
  const audit =
    intent === "reviewSave"
      ? "asset.reviewEdited"
      : intent === "approve"
        ? "asset.reviewApproved"
        : intent === "reject"
          ? "asset.reviewRejected"
          : intent === "withdraw"
            ? "asset.withdrawn"
            : intent === "pause"
              ? "asset.paused"
              : intent === "archive"
                ? "asset.archived"
                : intent === "delete"
                  ? "asset.deleted"
                  : null;
  if (audit)
    await logAdminAction({
      actorId: user.id,
      action: audit,
      targetType: "Asset",
      targetId: id,
      detail: asset.name,
    });
  publishProposalChange(id, asset.ownerId!);
  if (intent === "approve" || intent === "reject")
    await notifyProposalDecision(id);
  return { ok: true as const, intent, deleted };
}
