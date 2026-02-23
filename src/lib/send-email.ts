type SendEmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(payload: SendEmailPayload): Promise<void> {
  if (!payload?.to || !payload?.subject || (!payload?.text && !payload?.html)) {
    throw new Error("Invalid email payload");
  }

  const sender = process.env.EMAIL_FROM || "no-reply@office-app.local";

  // Fallback implementation: keeps build/runtime stable when SMTP is not configured.
  // Replace with real provider (SMTP/Resend/SendGrid) in production.
  console.log("[sendEmail] Email delivery is not configured. Logging payload instead.", {
    from: sender,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    hasHtml: Boolean(payload.html),
  });
}
