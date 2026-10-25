"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { MAX_WEBSITE_ENQUIRY_MESSAGE_LENGTH } from "@/domain/website-enquiries";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-controls";

export interface WebsiteEnquiryMessageView {
  body: string | null;
  createdAt: Date;
  id: string;
  senderKind: "CUSTOMER" | "STAFF" | "SYSTEM";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function WebsiteEnquiryChat({
  messages,
  publicReference,
  viewer,
}: {
  messages: WebsiteEnquiryMessageView[];
  publicReference: string;
  viewer: "CUSTOMER" | "MANAGEMENT";
}) {
  const router = useRouter();
  const key = useRef(crypto.randomUUID());
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(publicReference)}/enquiry-messages`, {
        body: JSON.stringify({ clientMessageKey: key.current, message: body }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "The message could not be sent.");
      setBody("");
      key.current = crypto.randomUUID();
      setMessage("Message sent.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-labelledby="website-enquiry-heading">
      <h2 id="website-enquiry-heading" className="text-xl font-semibold">Private website enquiry</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        {viewer === "CUSTOMER"
          ? "Talk privately with authorized management about the website you need. A chat message does not confirm a price or start production."
          : "Only the customer and active Owner/Admin members can read this conversation. Confirm commercial terms through the formal quotation controls."}
      </p>
      <ol className="mt-5 max-h-[32rem] space-y-3 overflow-y-auto rounded-xl border bg-muted-surface p-3 sm:p-4" aria-label="Website enquiry messages">
        {messages.length ? messages.map((item) => {
          const own = viewer === "CUSTOMER" ? item.senderKind === "CUSTOMER" : item.senderKind === "STAFF";
          return (
            <li className={own ? "ml-auto max-w-[88%] rounded-xl bg-primary p-3 text-primary-foreground" : "mr-auto max-w-[88%] rounded-xl border bg-surface p-3"} key={item.id}>
              <p className="whitespace-pre-wrap text-sm leading-6">{item.body}</p>
              <p className={own ? "mt-2 text-xs text-primary-foreground/75" : "mt-2 text-xs text-muted"}>
                {item.senderKind === "CUSTOMER" ? "Customer" : item.senderKind === "STAFF" ? "Capt. Bob management" : "System"} · {formatDate(item.createdAt)}
              </p>
            </li>
          );
        }) : <li className="p-4 text-center text-sm text-muted">No messages yet.</li>}
      </ol>
      <form className="mt-5" onSubmit={submit}>
        <label className="text-sm font-medium" htmlFor={`website-message-${viewer.toLowerCase()}`}>Write a message</label>
        <Textarea
          className="mt-2 min-h-28"
          disabled={sending}
          id={`website-message-${viewer.toLowerCase()}`}
          maxLength={MAX_WEBSITE_ENQUIRY_MESSAGE_LENGTH}
          onChange={(event) => setBody(event.target.value)}
          placeholder={viewer === "CUSTOMER" ? "Tell us more about your website." : "Reply to the customer."}
          required
          value={body}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">{body.length.toLocaleString("en-US")} / {MAX_WEBSITE_ENQUIRY_MESSAGE_LENGTH.toLocaleString("en-US")}</p>
          <Button disabled={sending || !body.trim()} type="submit">{sending ? "Sending…" : "Send message"}</Button>
        </div>
        {message ? <p className="mt-3 text-sm" role="status">{message}</p> : null}
      </form>
    </section>
  );
}
