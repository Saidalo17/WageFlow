import { isLocale, defaultLocale } from "@/i18n/config";
import type { Mail } from "@/lib/mail";

type Messages = { email: { reset: Record<string, string> } };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The "reset your password" email, in the language of the user's profile. */
export async function buildResetEmail(opts: {
  to: string;
  name: string | null;
  locale: string;
  link: string;
}): Promise<Mail> {
  const locale = isLocale(opts.locale) ? opts.locale : defaultLocale;
  const m = ((await import(`../messages/${locale}.json`)).default as Messages).email.reset;
  const first = opts.name?.trim().split(/\s+/)[0];
  const hello = first ? m.hello.replace("{name}", first) : m.helloAnon;

  const text = [hello, "", m.intro, "", opts.link, "", m.ignore].join("\n");
  const html = `<!doctype html><html lang="${locale}"><body style="margin:0;background:#f4f4f8;font-family:Arial,Helvetica,sans-serif;color:#1a1a2e">
<div style="max-width:480px;margin:0 auto;padding:24px">
<div style="background:#ffffff;border-radius:16px;padding:28px">
<p style="font-size:18px;font-weight:bold;margin:0 0 12px">${esc(hello)}</p>
<p style="line-height:1.5;margin:0 0 20px">${esc(m.intro)}</p>
<p style="margin:0 0 20px"><a href="${esc(opts.link)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:12px">${esc(m.button)}</a></p>
<p style="font-size:13px;color:#555;line-height:1.5;margin:0 0 6px">${esc(m.linkHint)}</p>
<p style="font-size:13px;word-break:break-all;margin:0 0 20px"><a href="${esc(opts.link)}" style="color:#4338ca">${esc(opts.link)}</a></p>
<p style="font-size:13px;color:#555;line-height:1.5;margin:0">${esc(m.ignore)}</p>
</div></div></body></html>`;
  return { to: opts.to, subject: m.subject, text, html };
}
