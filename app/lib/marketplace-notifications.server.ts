/** Gli avvisi personali P2P non passano dalla mailing list amministrativa. */
import { db } from "~/lib/db.server";
import {
  adminRecipients,
  deliver,
  type Recipient,
} from "~/lib/notifications.server";
import { fullLabelOf } from "~/lib/person";
import { formatDay } from "~/lib/availability.server";
const PERSON = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  alias: true,
  email: true,
  notifyChannel: true,
} as const;
const origin = () => process.env.APP_URL ?? "http://localhost:5173";
const recipient = (p: {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  alias: string | null;
}) => ({ ...p, name: fullLabelOf(p) });
async function safely(work: () => Promise<void>) {
  try {
    await work();
  } catch (error) {
    console.error("Avviso marketplace fallito:", error);
  }
}
async function send(
  people: Recipient[],
  subject: string,
  text: string,
  url: string,
) {
  const unique = new Map(people.map((p) => [p.email.toLowerCase(), p]));
  await Promise.all(
    [...unique.values()].map((p) =>
      deliver(p, {
        subject,
        text: `${text}\n\n${origin()}${url}`,
        push: {
          title: "Fabula",
          body: "There is an update to review.",
          url,
          tag: url,
        },
      }),
    ),
  );
}

export async function notifyLenderNewRequest(
  lenderId: string,
  summary: {
    requestId: string;
    requesterName: string;
    itemNames: string[];
    startDate: Date;
    endDate: Date;
    purpose: string | null;
  },
) {
  await safely(async () => {
    const lender = await db.user.findUnique({
      where: { id: lenderId },
      select: PERSON,
    });
    if (!lender) return;
    await send(
      [recipient(lender)],
      "Fabula: new request for your items",
      `${summary.requesterName} requested: ${summary.itemNames.join(", ")}\n${formatDay(summary.startDate)} → ${formatDay(summary.endDate)}\n${summary.purpose ?? ""}`,
      `/requests/${summary.requestId}`,
    );
  });
}

export async function notifyProposalSubmitted(id: string) {
  await safely(async () => {
    const asset = await db.asset.findUnique({
      where: { id },
      select: { name: true, ownerId: true },
    });
    if (!asset) return;
    const { people } = await adminRecipients();
    await send(
      people.filter((p) => p.id !== asset.ownerId),
      "Fabula: item proposal to review",
      `A member submitted ${asset.name} for review.`,
      `/admin/proposals/${id}`,
    );
  });
}
export async function notifyProposalDecision(id: string) {
  await safely(async () => {
    const asset = await db.asset.findUnique({
      where: { id },
      select: {
        name: true,
        status: true,
        rejectionReason: true,
        reviewedById: true,
        owner: { select: PERSON },
      },
    });
    if (!asset?.owner || asset.owner.id === asset.reviewedById) return;
    await send(
      [recipient(asset.owner)],
      "Fabula: your item proposal was reviewed",
      `${asset.name}: ${asset.status === "APPROVED" ? "published" : "needs changes"}.\n${asset.rejectionReason ?? ""}`,
      `/account/items/${id}`,
    );
  });
}

/** Il primo messaggio avvisa subito; le raffiche successive hanno un guardiano persistente. */
export async function notifyConversation(
  kind: "request" | "proposal",
  id: string,
  authorId: string,
  messageId: string,
) {
  await safely(async () => {
    const thread = `${kind}:${id}`;
    const recipients: Array<{
      person: Recipient;
      seenAt: Date | null;
      url: string;
    }> = [];
    let body = "";
    let createdAt = new Date();
    if (kind === "request") {
      const req = await db.request.findUnique({
        where: { id },
        select: {
          userId: true,
          lenderId: true,
          userSeenAt: true,
          lenderSeenAt: true,
          adminSeenAt: true,
          user: { select: PERSON },
          lender: { select: PERSON },
        },
      });
      const message = await db.message.findUnique({
        where: { id: messageId },
        select: { body: true, createdAt: true },
      });
      if (!req || !message) return;
      body = message.body;
      createdAt = message.createdAt;
      if (req.userId !== authorId)
        recipients.push({
          person: recipient(req.user),
          seenAt: req.userSeenAt,
          url: `/requests/${id}`,
        });
      if (req.lender) {
        if (req.lender.id !== authorId)
          recipients.push({
            person: recipient(req.lender),
            seenAt: req.lenderSeenAt,
            url: `/requests/${id}`,
          });
      } else {
        const { people } = await adminRecipients();
        recipients.push(
          ...people
            .filter((p) => p.id !== authorId)
            .map((person) => ({
              person,
              seenAt: req.adminSeenAt,
              url: `/requests/${id}`,
            })),
        );
      }
    } else {
      const asset = await db.asset.findUnique({
        where: { id },
        select: {
          ownerId: true,
          ownerSeenAt: true,
          moderatorSeenAt: true,
          owner: { select: PERSON },
        },
      });
      const message = await db.assetMessage.findUnique({
        where: { id: messageId },
        select: { body: true, createdAt: true },
      });
      if (!asset?.owner || !message) return;
      body = message.body;
      createdAt = message.createdAt;
      if (asset.ownerId === authorId) {
        const { people } = await adminRecipients();
        recipients.push(
          ...people
            .filter((p) => p.id !== authorId)
            .map((person) => ({
              person,
              seenAt: asset.moderatorSeenAt,
              url: `/admin/proposals/${id}`,
            })),
        );
      } else
        recipients.push({
          person: recipient(asset.owner),
          seenAt: asset.ownerSeenAt,
          url: `/account/items/${id}`,
        });
    }
    for (const { person, seenAt, url } of recipients) {
      if (seenAt && seenAt >= createdAt) continue;
      const sentAt = new Date();
      const before = new Date(sentAt.getTime() - 5 * 60_000);
      const claim = await db
        .$transaction(async (tx) => {
          const exists = await tx.conversationNotice.findUnique({
            where: { thread_recipientId: { thread, recipientId: person.id } },
            select: { id: true },
          });
          if (!exists) {
            await tx.conversationNotice.create({
              data: {
                thread,
                recipientId: person.id,
                lastMessageId: messageId,
                sentAt,
              },
            });
            return true;
          }
          const updated = await tx.conversationNotice.updateMany({
            where: {
              id: exists.id,
              sentAt: { lte: before },
              lastMessageId: { not: messageId },
            },
            data: { sentAt, lastMessageId: messageId },
          });
          return updated.count === 1;
        })
        .catch(() => false);
      if (claim)
        await send([person], "Fabula: new conversation message", body, url);
    }
  });
}

export async function notifyLoanChanged(
  id: string,
  actorId: string,
  event: "editDates" | "cancel" | "pickup" | "return" | "archive",
) {
  await safely(async () => {
    const req = await db.request.findUnique({
      where: { id },
      select: {
        userId: true,
        lenderId: true,
        user: { select: PERSON },
        lender: { select: PERSON },
      },
    });
    if (!req) return;
    let people: Recipient[];
    if (req.lender) people = [recipient(req.user), recipient(req.lender)];
    else {
      const admins = await adminRecipients();
      people = actorId === req.userId ? admins.people : [recipient(req.user)];
    }
    await send(
      people.filter((p) => p.id !== actorId),
      "Fabula: loan updated",
      `A loan was updated: ${event}. Open the request for details.`,
      `/requests/${id}`,
    );
  });
}

export async function notifyLenderOverdueDigest(
  lender: Recipient,
  rows: Array<{ holder: string; itemNames: string[]; daysLate: number }>,
  dayKey: string,
) {
  await safely(async () => {
    const claim = await db.digestNotice
      .create({ data: { recipientId: lender.id, dayKey } })
      .then(() => true)
      .catch(() => false);
    if (!claim) return;
    const delivered = await deliver(lender, {
      subject: "Fabula: overdue items you lent",
      text:
        rows
          .map(
            (r) =>
              `${r.holder}: ${r.itemNames.join(", ")} (${r.daysLate} days late)`,
          )
          .join("\n") + `\n\n${origin()}/account/lending`,
      push: {
        title: "Return update",
        body: "Some loans need your attention.",
        url: "/account/lending",
      },
    });
    if (!delivered)
      await db.digestNotice.deleteMany({
        where: { recipientId: lender.id, dayKey },
      });
  });
}

/** L'assistenza admin sugli oggetti pubblicati resta visibile al proprietario. */
export async function notifyAssetAdminChanged(
  id: string,
  actorId: string,
  event: string,
) {
  await safely(async () => {
    const asset = await db.asset.findUnique({
      where: { id },
      select: { owner: { select: PERSON } },
    });
    if (!asset?.owner) return;
    if (asset.owner.id !== actorId)
      await send(
        [recipient(asset.owner)],
        "Fabula: your item was updated",
        `An administrator updated your item (${event}). Open its private page for details.`,
        `/account/items/${id}`,
      );
    if (event === "archive") {
      const loans = await db.request.findMany({
        where: {
          items: { some: { assetId: id, returnedAt: null } },
          status: { in: ["PENDING", "APPROVED"] },
        },
        select: { id: true },
      });
      for (const loan of loans)
        await notifyLoanChanged(loan.id, actorId, "archive");
    }
  });
}
