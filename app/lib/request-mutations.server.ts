/** Decisioni e passaggi di mano: permessi e controlli dentro la stessa transazione. */
import { Prisma } from "~/generated/prisma/client";
import { db } from "~/lib/db.server";
import { requestCapabilities } from "~/lib/marketplace";
import { lockAssets } from "~/lib/request-locks.server";
import { requireRequestAccess } from "~/lib/request-access.server";
import {
  parseDay,
  todayUtc,
  formatDay,
  getBusyAssetIds,
  MAX_ORDINARY_SPAN_DAYS,
  MAX_SPECIAL_SPAN_DAYS,
} from "~/lib/availability.server";
import {
  notifyRequesterDecision,
  sendReturnReminder,
} from "~/lib/notifications.server";
import {
  notifyConversation,
  notifyLoanChanged,
} from "~/lib/marketplace-notifications.server";
import {
  publishRequestChange,
  publishLendingChange,
} from "~/lib/events.server";
import { logAdminAction } from "~/lib/audit.server";
import { fullLabelOf } from "~/lib/person";
import type { CurrentUser } from "~/lib/session.server";
import type { TranslationKey } from "~/i18n/dictionaries";
export class RequestMutationError extends Error {
  constructor(
    public key: TranslationKey,
    public conflicts: string[] = [],
  ) {
    super(key);
  }
}
const PERSON = {
  id: true,
  email: true,
  name: true,
  firstName: true,
  lastName: true,
  alias: true,
} as const;
const SELECT = {
  batchId: true,
  id: true,
  userId: true,
  lenderId: true,
  status: true,
  startDate: true,
  endDate: true,
  user: { select: PERSON },
  items: {
    select: {
      id: true,
      assetId: true,
      pickedUpAt: true,
      returnedAt: true,
      asset: {
        select: {
          id: true,
          ownerId: true,
          name: true,
          location: true,
          isBookable: true,
          status: true,
          archivedAt: true,
        },
      },
    },
  },
} as const;

export async function mutateRequest(
  user: CurrentUser,
  id: string,
  form: FormData,
  origin: string,
) {
  await requireRequestAccess(user, id);
  const intent = String(form.get("intent") ?? "");
  if (intent === "message") {
    const body = String(form.get("body") ?? "")
      .trim()
      .slice(0, 2000);
    if (!body) throw new RequestMutationError("request.errorMessageEmpty");
    const message = await db.message.create({
      data: { requestId: id, authorId: user.id, body },
      select: { id: true },
    });
    const req = await db.request.findUniqueOrThrow({
      where: { id },
      select: { lenderId: true, batchId: true },
    });
    publishRequestChange(id, req.batchId);
    if (req.lenderId) publishLendingChange(req.lenderId);
    await notifyConversation("request", id, user.id, message.id);
    return { ok: true as const, intent };
  }
  const initial = await db.request.findUniqueOrThrow({
    where: { id },
    select: { items: { select: { assetId: true } } },
  });
  const req = await db.$transaction(async (tx) => {
    await lockAssets(
      tx,
      initial.items.map((i) => i.assetId),
    );
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Request" WHERE "id" = ${id} FOR UPDATE`,
    );
    const current = await tx.request.findUniqueOrThrow({
      where: { id },
      select: SELECT,
    });
    const caps = requestCapabilities(user, current);
    if (!caps.read) throw new Response("Not found", { status: 404 });
    const anyPicked = current.items.some((i) => i.pickedUpAt !== null);
    if (intent === "editDates") {
      if (!caps.edit) throw new Response("Not found", { status: 404 });
      if (anyPicked)
        throw new RequestMutationError("request.errorAlreadyPickedUp");
      if (current.status !== "PENDING" && current.status !== "APPROVED")
        throw new RequestMutationError("request.errorNotPendingOrApproved");
      const from = parseDay(String(form.get("from") ?? ""));
      const to = parseDay(String(form.get("to") ?? ""));
      const longer = form.get("longer") === "1";
      const purpose = String(form.get("purpose") ?? "")
        .trim()
        .slice(0, 2000);
      if (!from || !to || from < todayUtc() || to < from)
        throw new RequestMutationError("request.errorDates");
      const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
      if (
        (!longer && days > MAX_ORDINARY_SPAN_DAYS) ||
        days > MAX_SPECIAL_SPAN_DAYS
      )
        throw new RequestMutationError("request.errorSpan");
      if (longer && !purpose)
        throw new RequestMutationError("request.errorPurposeRequired");
      const busy = await getBusyAssetIds(from, to, {
        tx,
        excludeRequestId: id,
      });
      const conflicts = current.items
        .filter((i) => busy.has(i.assetId))
        .map((i) => i.asset.name);
      if (conflicts.length)
        throw new RequestMutationError("request.errorConflict", conflicts);
      await tx.request.update({
        where: { id },
        data: {
          startDate: from,
          endDate: to,
          purpose: purpose || null,
          status: "PENDING",
          decidedAt: null,
          decidedById: null,
        },
      });
    } else if (intent === "cancel") {
      if (!caps.borrower && !caps.manage)
        throw new Response("Not found", { status: 404 });
      if (anyPicked)
        throw new RequestMutationError("request.errorAlreadyPickedUp");
      if (current.status !== "PENDING" && current.status !== "APPROVED")
        throw new RequestMutationError("request.errorGeneric");
      await tx.request.update({ where: { id }, data: { status: "CANCELLED" } });
    } else if (intent === "note") {
      if (!caps.admin) throw new Response("Not found", { status: 404 });
      await tx.request.update({
        where: { id },
        data: {
          adminNote:
            String(form.get("note") ?? "")
              .trim()
              .slice(0, 5000) || null,
        },
      });
    } else {
      if (!caps.manage) throw new Response("Not found", { status: 404 });
      if (intent === "approve" || intent === "reject") {
        if (current.status !== "PENDING")
          throw new RequestMutationError("request.errorNotPending");
        if (intent === "approve") {
          if (
            current.items.some(
              (i) =>
                i.asset.archivedAt ||
                i.asset.status !== "APPROVED" ||
                !i.asset.isBookable ||
                i.asset.ownerId !== current.lenderId,
            )
          )
            throw new RequestMutationError("request.errorUnavailable");
          const busy = await getBusyAssetIds(
            current.startDate,
            current.endDate,
            { tx, excludeRequestId: id },
          );
          const conflicts = current.items
            .filter((i) => busy.has(i.assetId))
            .map((i) => i.asset.name);
          if (conflicts.length)
            throw new RequestMutationError("request.errorConflict", conflicts);
        }
        await tx.request.update({
          where: { id },
          data: {
            status: intent === "approve" ? "APPROVED" : "REJECTED",
            decidedAt: new Date(),
            decidedById: user.id,
          },
        });
      } else if (intent === "pickup" || intent === "return") {
        if (current.status !== "APPROVED")
          throw new RequestMutationError("request.errorGeneric");
        const itemId = String(form.get("itemId") ?? "");
        const item = current.items.find((i) => i.id === itemId);
        if (
          !item ||
          (caps.lender && item.asset.ownerId !== user.id) ||
          item.asset.archivedAt
        )
          throw new RequestMutationError("request.errorGeneric");
        if (
          intent === "pickup"
            ? Boolean(item.pickedUpAt)
            : !item.pickedUpAt || Boolean(item.returnedAt)
        )
          throw new RequestMutationError("request.errorGeneric");
        await tx.requestItem.update({
          where: { id: itemId },
          data:
            intent === "pickup"
              ? { pickedUpAt: new Date() }
              : { returnedAt: new Date() },
        });
      } else if (intent === "reminder") {
        if (current.status !== "APPROVED")
          throw new RequestMutationError("request.errorGeneric");
      } else throw new RequestMutationError("request.errorGeneric");
    }
    return current;
  });
  const to = { ...req.user, name: fullLabelOf(req.user) };
  const summary = {
    to,
    itemNames: req.items.map((i) => i.asset.name),
    startDate: req.startDate,
    endDate: req.endDate,
    requestId: id,
    origin,
  };
  if (intent === "approve" || intent === "reject") {
    await notifyRequesterDecision({
      ...summary,
      decision: intent === "approve" ? "approved" : "rejected",
    }).catch((error) => console.error("Avviso decisione fallito:", error));
    await logAdminAction({
      actorId: user.id,
      action: intent === "approve" ? "request.approve" : "request.reject",
      targetType: "Request",
      targetId: id,
      detail: `${req.items.map((i) => i.asset.name).join(", ")} (${formatDay(req.startDate)} → ${formatDay(req.endDate)})${user.role === "ADMIN" && req.lenderId !== null && req.lenderId !== user.id ? " · intervento admin" : ""}`,
    });
  } else if (intent === "pickup" || intent === "return") {
    const item = req.items.find((i) => i.id === String(form.get("itemId")))!;
    await logAdminAction({
      actorId: user.id,
      action: intent === "pickup" ? "requestItem.pickup" : "requestItem.return",
      targetType: "RequestItem",
      targetId: item.id,
      detail: `${item.asset.name} — ${fullLabelOf(req.user)}`,
    });
    await notifyLoanChanged(id, user.id, intent);
  } else if (intent === "cancel" || intent === "editDates") {
    if (intent === "cancel" && user.id !== req.userId)
      await logAdminAction({
        actorId: user.id,
        action: "request.cancel",
        targetType: "Request",
        targetId: id,
        detail: req.items.map((i) => i.asset.name).join(", "),
      });
    await notifyLoanChanged(id, user.id, intent);
  } else if (intent === "reminder") {
    const items = req.items
      .filter((i) => i.pickedUpAt && !i.returnedAt && !i.asset.archivedAt)
      .map((i) => i.asset);
    if (!items.length || !(await sendReturnReminder({ ...summary, items })))
      throw new RequestMutationError("request.errorReminderFailed");
  }
  publishRequestChange(id, req.batchId);
  if (req.lenderId) publishLendingChange(req.lenderId);
  return { ok: true as const, intent };
}
