/** La stessa conversazione accessibile per revisione e prestito, con destinatari espliciti. */
import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/button";
import { PersonInline } from "~/components/person";
import { AdminBadge } from "~/components/admin-badge";
import { useLang, useT } from "~/i18n/use-t";
import type { Person } from "~/lib/person";
import type { TranslationKey } from "~/i18n/dictionaries";

export type ConversationMessage = {
  id: string;
  body: string;
  createdAt: string;
  author: Person;
  authorIsAdmin: boolean;
  isMine: boolean;
};
export function Conversation({
  id,
  messages,
  review = false,
}: {
  id: string;
  messages: ConversationMessage[];
  review?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const form = useRef<HTMLFormElement>(null);
  const fetcher = useFetcher<{ ok: boolean; error?: TranslationKey }>();
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) form.current?.reset();
  }, [fetcher.state, fetcher.data]);
  return (
    <section className="mt-8 border-t border-rule pt-5">
      <h2 className="font-serif text-xl font-semibold">
        {t(review ? "p2p.reviewChat" : "requests.chat.heading")}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {t(review ? "p2p.chatHint" : "p2p.loanChatHint")}
      </p>
      <ul className="mt-5 flex flex-col gap-3">
        {messages.length === 0 && (
          <li className="text-sm text-muted">{t("requests.chat.empty")}</li>
        )}
        {messages.map((m) => (
          <li
            key={m.id}
            className={`max-w-[95%] rounded-sm border border-rule p-3 text-sm sm:max-w-[85%] ${m.isMine ? "ml-auto bg-accent-soft" : "bg-card"}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span>
                <PersonInline person={m.author} />
                {m.authorIsAdmin && (
                  <span className="ml-2">
                    <AdminBadge />
                  </span>
                )}
              </span>
              <time
                dateTime={m.createdAt}
                className="font-mono text-2xs text-muted"
              >
                {new Date(m.createdAt).toLocaleString(lang, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words">{m.body}</p>
          </li>
        ))}
      </ul>
      <fetcher.Form
        ref={form}
        method="post"
        className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="intent" value="message" />
        <div className="min-w-0 flex-1">
          <label htmlFor={`body-${id}`} className="eyebrow">
            {t("requests.chat.placeholder")}
          </label>
          <textarea
            id={`body-${id}`}
            name="body"
            rows={3}
            maxLength={2000}
            required
            className="field mt-1.5 w-full"
          />
        </div>
        <Button type="submit" variant="primary" busy={fetcher.state !== "idle"}>
          {t("requests.chat.send")}
        </Button>
      </fetcher.Form>
      {fetcher.data?.error && (
        <p role="alert" className="mt-3 text-sm text-out">
          {t(fetcher.data.error)}
        </p>
      )}
    </section>
  );
}
