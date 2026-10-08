// The 10 Minute English look for every email: a green header with the name
// (text only — no image that can fail to load), the message, and a quiet
// footer. Table-based with inline styles, since that's what email clients
// reliably render.

const BRAND_GREEN = '#58cc02';
const BRAND_GREEN_DARK = '#46a302';
const BRAND_BLUE = '#1cb0f6';
const TEXT = '#3c3c3c';
const MUTED = '#777777';

function frontendUrl(): string {
  return (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Escapes text, then turns bare URLs into links.
function linkify(text: string): string {
  return escapeHtml(text).replace(
    /https?:\/\/[^\s<]+/g,
    (url) => `<a href="${url}" style="color:${BRAND_BLUE};font-weight:bold;word-break:break-all;">${url}</a>`,
  );
}

export function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:${TEXT};">${html}</p>`;
}

export function button(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td style="background:${BRAND_GREEN};border-bottom:4px solid ${BRAND_GREEN_DARK};border-radius:12px;">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.5px;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

// Wraps already-built content (trusted HTML) in the branded frame.
export function brandedHtml(title: string, contentHtml: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f7f0;font-family:Nunito,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f0;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:2px solid #e5e5e5;border-bottom-width:4px;border-radius:16px;overflow:hidden;">
<tr><td style="background:${BRAND_GREEN};padding:18px 24px;">
<span style="font-size:20px;font-weight:900;color:#ffffff;letter-spacing:0.3px;">10 Minute English</span>
</td></tr>
<tr><td style="padding:28px 24px 12px;">${contentHtml}</td></tr>
<tr><td style="padding:16px 24px 24px;border-top:2px solid #f0f0f0;font-size:13px;line-height:1.5;color:${MUTED};">
Practise English 10 minutes at a time.<br><a href="${frontendUrl()}" style="color:${MUTED};">Open 10 Minute English</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

// Any plain-text email, in the branded frame: blank lines become paragraphs,
// single line breaks stay, URLs become links.
export function brandedHtmlFromText(subject: string, body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => paragraph(linkify(p).replace(/\n/g, '<br>')));
  return brandedHtml(subject, paragraphs.join(''));
}

export const EMAIL_COLORS = { BRAND_GREEN, BRAND_BLUE, TEXT, MUTED };
