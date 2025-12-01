import { resendClient } from "../clients/resend";
import { config } from "../config";

type InviteEmailInput = {
  invites: { email: string; token: string }[];
  session: { id: string; title: string; startsAt: Date; endsAt: Date };
  source: { title: string };
  baseUrl: string;
  from: string;
};

export async function sendInviteEmails(input: InviteEmailInput) {
  if (!resendClient) return;

  const joinUrlFor = (token: string) =>
    `${input.baseUrl}/join?sessionId=${encodeURIComponent(
      input.session.id,
    )}&token=${encodeURIComponent(token)}`;

  const messages = input.invites.map((invite) => ({
    from: input.from,
    to: invite.email,
    subject: `You're invited: ${input.session.title}`,
    html: `
\t\t\t\t<p>You have been invited to participate in a collaborative poem.</p>
\t\t\t\t<p><strong>Session:</strong> ${input.session.title}</p>
\t\t\t\t<p><strong>Source:</strong> ${input.source.title}</p>
\t\t\t\t<p><strong>Starts:</strong> ${input.session.startsAt.toISOString()}</p>
\t\t\t\t<p><strong>Ends:</strong> ${input.session.endsAt.toISOString()}</p>
\t\t\t\t<p><a href="${joinUrlFor(invite.token)}">Join session</a></p>
\t\t\t`,
    text: `You have been invited! Collaborative poem session @ ${input.session.startsAt.toISOString()}.
Session: ${input.session.title}
Source: ${input.source.title}
Starts: ${input.session.startsAt.toISOString()}
Ends: ${input.session.endsAt.toISOString()}
Join: ${joinUrlFor(invite.token)}`,
  }));

  console.log("[invites] sending batch", {
    count: messages.length,
    sessionId: input.session.id,
  });

  try {
    const response = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const data = await response.json().catch(() => ({}));
    console.log("[invites] batch response", {
      status: response.status,
      ok: response.ok,
      ids: data?.data ?? data?.ids ?? null,
      errors: data?.error ?? null,
    });

    if (!response.ok) {
      throw new Error(
        `Resend batch failed ${response.status} ${JSON.stringify(data)}`,
      );
    }
  } catch (error) {
    console.error(
      "[invites] batch send failed, falling back to single send",
      error,
    );
    for (const invite of input.invites) {
      try {
        console.log("[invites] fallback send", { email: invite.email });
        await resendClient.emails.send({
          from: input.from,
          to: invite.email,
          subject: `You're invited: ${input.session.title}`,
          html: `
\t\t<p>You have been invited to a Found Poems collaboration.</p>
\t\t<p><strong>Session:</strong> ${input.session.title}</p>
\t\t<p><strong>Source:</strong> ${input.source.title}</p>
\t\t<p><strong>Starts:</strong> ${input.session.startsAt.toISOString()}</p>
\t\t<p><strong>Ends:</strong> ${input.session.endsAt.toISOString()}</p>
\t\t<p><a href="${joinUrlFor(invite.token)}">Join session</a></p>
\t`,
          text: `You have been invited to a Found Poems collaboration.
Session: ${input.session.title}
Source: ${input.source.title}
Starts: ${input.session.startsAt.toISOString()}
Ends: ${input.session.endsAt.toISOString()}
Join: ${joinUrlFor(invite.token)}`,
        });
      } catch (fallbackError) {
        console.error("[invites] fallback send failed", {
          email: invite.email,
          error: fallbackError,
        });
      }
    }
  }
}
