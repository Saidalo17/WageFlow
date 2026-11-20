import fs from "node:fs";
import nodemailer from "nodemailer";

export type Mail = { to: string; subject: string; text: string; html: string };

export class MailNotConfiguredError extends Error {
  constructor() {
    super("Email is not configured: set SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM");
    this.name = "MailNotConfiguredError";
  }
}

/**
 * Sends an email over SMTP (Gmail, Resend, Brevo... any provider).
 * Settings come from the environment: SMTP_HOST, SMTP_PORT (587 or 465), SMTP_USER, SMTP_PASS, MAIL_FROM.
 * For tests, MAIL_OUTBOX_FILE=path appends every email as one JSON line to that file instead of sending it.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const outbox = process.env.MAIL_OUTBOX_FILE;
  if (outbox) {
    fs.appendFileSync(outbox, JSON.stringify(mail) + "\n");
    return;
  }
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !MAIL_FROM) throw new MailNotConfiguredError();
  const port = Number(process.env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
  });
  await transport.sendMail({ from: MAIL_FROM, ...mail });
}
