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

const ERROR_RED = '#ff4b4b';

export function heading(text: string): string {
  return `<h1 style="margin:0 0 12px;font-size:22px;font-weight:900;line-height:1.3;color:${TEXT};">${escapeHtml(text)}</h1>`;
}

// One lesson as a card: a calendar-style date badge, then date, time and who
// it's with. A cancelled lesson's badge turns grey with a red "CANCELLED" tag.
export function lessonCard(lesson: {
  date: string;
  time: string;
  weekday: string;
  day: string;
  month: string;
  withName: string;
  cancelled?: boolean;
}): string {
  const accent = lesson.cancelled ? '#afafaf' : BRAND_GREEN;
  const tag = lesson.cancelled
    ? `<div style="margin-top:4px;"><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#ffdfe0;color:${ERROR_RED};font-size:11px;font-weight:bold;letter-spacing:0.5px;">CANCELLED</span></div>`
    : '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px;border:2px solid #e5e5e5;border-radius:12px;"><tr>
<td width="64" style="padding:12px 0 12px 12px;vertical-align:middle;">
<div style="width:48px;border:2px solid ${accent};border-radius:10px;text-align:center;overflow:hidden;">
<div style="background:${accent};color:#fff;font-size:11px;font-weight:bold;padding:2px 0;">${escapeHtml(lesson.month.toUpperCase())}</div>
<div style="font-size:20px;font-weight:900;color:${TEXT};padding:2px 0 0;">${escapeHtml(lesson.day)}</div>
<div style="font-size:10px;font-weight:bold;color:${MUTED};padding:0 0 3px;">${escapeHtml(lesson.weekday.toUpperCase())}</div>
</div></td>
<td style="padding:12px;vertical-align:middle;font-size:15px;color:${TEXT};">
<div style="font-weight:bold;${lesson.cancelled ? `color:${MUTED};text-decoration:line-through;` : ''}">${escapeHtml(lesson.date)} · ${escapeHtml(lesson.time)}</div>
<div style="font-size:14px;color:${MUTED};">with ${escapeHtml(lesson.withName)}</div>
${tag}
</td></tr></table>`;
}

// Someone's own words (e.g. a cancellation reason), set apart and escaped.
export function quote(label: string, text: string): string {
  return `<div style="margin:0 0 16px;padding:12px 14px;border-radius:12px;background:#eef8ff;">
<div style="font-size:12px;font-weight:bold;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(label)}</div>
<div style="margin-top:2px;font-size:16px;font-weight:bold;font-style:italic;color:${TEXT};">“${escapeHtml(text)}”</div>
</div>`;
}

// A highlighted line: green for good news (a refund), amber for a caution.
export function note(html: string, tone: 'good' | 'caution'): string {
  const [bg, fg] = tone === 'good' ? ['#d7ffb8', '#46a302'] : ['#fff3cd', '#a86a00'];
  return `<p style="margin:0 0 16px;padding:12px 14px;border-radius:12px;background:${bg};color:${fg};font-size:15px;font-weight:bold;line-height:1.4;">${html}</p>`;
}

export function appUrl(path: string): string {
  return `${frontendUrl()}${path}`;
}

export const EMAIL_COLORS = { BRAND_GREEN, BRAND_BLUE, TEXT, MUTED };
