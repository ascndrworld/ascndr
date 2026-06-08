import type { APIRoute } from "astro";

// Endpoint bajo demanda (serverless en Vercel); el resto del sitio sigue estático.
export const prerender = false;

// ── Config de remitentes/destinatario (cambia aquí si quieres otra dirección) ──
const OWNER_EMAIL = "frank@ascndrworld.com";              // a quién le llega el aviso
const FROM_NOTIFY = "Web Ascndr <frank@ascndrworld.com>"; // remitente del aviso
const FROM_REPLY  = "Ascndr <frank@ascndrworld.com>";     // remitente de la auto-respuesta

// ── Marca (para el diseño de los emails) ──
const SITE = "https://www.ascndrworld.com";
const BAND = "https://www.ascndrworld.com/email-logo-band.png"; // logo crema sobre banda negra (imagen: Gmail no la recolorea)
const IG   = "https://www.instagram.com/ascndr.world";

const RESEND_API_KEY =
  import.meta.env.RESEND_API_KEY ??
  (globalThis as any).process?.env?.RESEND_API_KEY;

// ── Telegram (aviso instantáneo de nuevo lead) ──
const TELEGRAM_BOT_TOKEN =
  import.meta.env.TELEGRAM_BOT_TOKEN ??
  (globalThis as any).process?.env?.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID =
  import.meta.env.TELEGRAM_CHAT_ID ??
  (globalThis as any).process?.env?.TELEGRAM_CHAT_ID;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function esc(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// "Plantilla" base de los emails: cabecera (banda con logo, imagen) + cuerpo claro + pie.
// El cuerpo es claro a propósito: Gmail recolorea fondos pero NO imágenes, así que la
// banda negra con el logo crema se ve siempre bien, y el resto sobrevive al modo oscuro.
function shell(body: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
</head>
<body style="margin:0;padding:0;background-color:#e7e2d4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#e7e2d4" style="background-color:#e7e2d4;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid rgba(0,0,0,0.08);">
        <tr><td style="padding:0;font-size:0;line-height:0;">
          <img src="${BAND}" alt="Ascndr" width="600" style="display:block;border:0;width:100%;max-width:600px;height:auto;">
        </td></tr>
        <tr><td style="padding:40px;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#141414;">
          ${body}
        </td></tr>
        <tr><td align="center" style="padding:26px 40px;border-top:1px solid rgba(0,0,0,0.08);font-family:Montserrat,Helvetica,Arial,sans-serif;text-align:center;">
          <p style="margin:0;font-size:12px;line-height:1.7;letter-spacing:0.03em;color:#8a857a;text-align:center;">
            Ascndr · Consultoría creativa<br>
            <a href="${SITE}" style="color:#5a564e;text-decoration:none;">ascndrworld.com</a>
            &nbsp;·&nbsp;
            <a href="${IG}" style="color:#5a564e;text-decoration:none;">Instagram</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function field(label: string, value: string) {
  return `<tr><td style="padding:0 0 20px;">
    <div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#9a948a;margin:0 0 4px;">${label}</div>
    <div style="font-size:16px;line-height:1.5;color:#141414;">${value}</div>
  </td></tr>`;
}

const BTN = "display:inline-block;background:#000000;color:#F7EFDB;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;padding:14px 30px;";

async function sendEmail(payload: Record<string, unknown>) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
  return res.json();
}

// Envía un mensaje al chat de Telegram del dueño (parse_mode HTML; escapa el contenido con esc()).
async function sendTelegram(text: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("Telegram sin configurar (faltan TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).");
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Telegram ${res.status}: ${detail}`);
  }
  return res.json();
}

export const POST: APIRoute = async ({ request }) => {
  if (!RESEND_API_KEY) {
    console.error("Falta RESEND_API_KEY en el entorno.");
    return json(500, { error: "config" });
  }

  let data: any;
  try {
    data = await request.json();
  } catch {
    return json(400, { error: "Petición inválida." });
  }

  const name = (data.name || "").trim();
  const email = (data.email || "").trim();
  const phone = (data.phone || "").trim();
  const consulta = (data.consulta || "").trim();
  const website = data.website || ""; // honeypot

  // Bot: fingimos éxito y no enviamos nada
  if (website) return json(200, { ok: true });

  if (!name || !email) return json(400, { error: "Completa al menos nombre y email." });
  if (!isValidEmail(email)) return json(400, { error: "Revisa el formato del email." });

  const notifyHtml = shell(`
    <div style="font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#9a948a;margin:0 0 8px;">Nuevo contacto</div>
    <h1 style="margin:0 0 30px;font-size:26px;font-weight:800;letter-spacing:-0.5px;color:#141414;">Tienes un mensaje nuevo</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${field("Nombre", esc(name))}
      ${field("Email", `<a href="mailto:${esc(email)}" style="color:#141414;text-decoration:underline;">${esc(email)}</a>`)}
      ${field("Dónde está", esc(phone) || "No facilitado")}
      ${field("Proyecto", esc(consulta).replace(/\n/g, "<br>") || "Sin consulta previa")}
    </table>
    <a href="mailto:${esc(email)}" style="${BTN}margin-top:10px;">Responder a ${esc(name)}</a>`);

  const autoHtml = shell(`
    <h1 style="margin:0 0 22px;font-size:28px;font-weight:800;letter-spacing:-0.5px;color:#141414;">Gracias, ${esc(name)}</h1>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#4a4744;">Hemos recibido tu mensaje y lo estamos revisando. Te responderemos personalmente en <strong style="color:#141414;">menos de 24 horas</strong>.</p>
    <p style="margin:30px 0 0;font-size:15px;line-height:1.6;color:#4a4744;">Un saludo,<br><strong style="color:#141414;">Frank</strong></p>`);

  // Versiones en texto plano (alternativa al HTML: mejora entregabilidad y accesibilidad).
  const notifyText = [
    "NUEVO CONTACTO",
    "",
    "Tienes un mensaje nuevo.",
    "",
    `Nombre: ${name}`,
    `Email: ${email}`,
    `Dónde está: ${phone || "No facilitado"}`,
    `Proyecto: ${consulta || "Sin consulta previa"}`,
    "",
    `Responder: ${email}`,
    "",
    "—",
    "Ascndr · Consultoría creativa",
    "ascndrworld.com · instagram.com/ascndr.world",
  ].join("\n");

  const autoText = [
    `Gracias, ${name}`,
    "",
    "Hemos recibido tu mensaje y lo estamos revisando. Te responderemos personalmente en menos de 24 horas.",
    "",
    "Un saludo,",
    "Frank",
    "",
    "—",
    "Ascndr · Consultoría creativa",
    "ascndrworld.com · instagram.com/ascndr.world",
  ].join("\n");

  // 1) Aviso a ti (obligatorio) — responder va directo al cliente
  try {
    await sendEmail({
      from: FROM_NOTIFY,
      to: [OWNER_EMAIL],
      reply_to: email,
      subject: `Nuevo contacto: ${name}`,
      html: notifyHtml,
      text: notifyText,
    });
  } catch (err) {
    console.error("Error enviando aviso:", err);
    return json(502, { error: "No hemos podido enviar el mensaje." });
  }

  // 2) Auto-respuesta al cliente (no bloquea: si falla, el aviso ya salió)
  try {
    await sendEmail({
      from: FROM_REPLY,
      to: [email],
      reply_to: OWNER_EMAIL,
      subject: "Hemos recibido tu mensaje ✦",
      html: autoHtml,
      text: autoText,
    });
  } catch (err) {
    console.warn("Auto-respuesta no enviada:", err);
  }

  // 3) Aviso instantáneo a Telegram (no bloquea: si falla, el email ya salió)
  const tgText = [
    "📩 <b>Nuevo cliente</b> · formulario web",
    "",
    `👤 <b>${esc(name)}</b>`,
    `✉️ ${esc(email)}`,
    `📍 ${esc(phone) || "—"}`,
    "",
    "📝 <b>Consulta</b>",
    esc(consulta) || "Sin consulta previa",
  ].join("\n");
  try {
    await sendTelegram(tgText);
  } catch (err) {
    console.warn("Aviso Telegram no enviado:", err);
  }

  return json(200, { ok: true });
};
