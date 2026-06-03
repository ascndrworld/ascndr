import type { APIRoute } from "astro";

// Endpoint bajo demanda (serverless en Vercel); el resto del sitio sigue estático.
export const prerender = false;

// ── Config de remitentes/destinatario (cambia aquí si quieres otra dirección) ──
const OWNER_EMAIL = "frank@ascndrworld.com";              // a quién le llega el aviso
const FROM_NOTIFY = "Web Ascndr <frank@ascndrworld.com>"; // remitente del aviso
const FROM_REPLY  = "Ascndr <frank@ascndrworld.com>";     // remitente de la auto-respuesta

// ── Marca (para el diseño de los emails) ──
const SITE = "https://www.ascndrworld.com";
const LOGO = "https://www.ascndrworld.com/ascndr-logo.png";
const IG   = "https://www.instagram.com/ascndr.world";

const RESEND_API_KEY =
  import.meta.env.RESEND_API_KEY ??
  (globalThis as any).process?.env?.RESEND_API_KEY;

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

// "Plantilla" base de los emails: cabecera con logo + pie, estética Ascndr
function shell(body: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark only">
<meta name="supported-color-schemes" content="dark only">
<style>
  :root { color-scheme: dark only; supported-color-schemes: dark only; }
  body, .bg-outer { background-color: #0a0a0a !important; }
  .bg-inner { background-color: #000000 !important; }
  /* Outlook (modo oscuro): mantener el fondo negro */
  [data-ogsc] body, [data-ogsb] body { background-color: #0a0a0a !important; }
  [data-ogsb] .bg-inner { background-color: #000000 !important; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg-outer" style="background-color:#0a0a0a;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="bg-inner" style="width:100%;max-width:600px;background-color:#000000;border:1px solid rgba(247,239,219,0.12);">
        <tr><td align="center" style="padding:34px 40px 26px;border-bottom:1px solid rgba(247,239,219,0.12);text-align:center;">
          <img src="${LOGO}" width="138" alt="Ascndr" style="display:block;border:0;width:138px;height:auto;margin:0 auto;">
        </td></tr>
        <tr><td style="padding:40px;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#F7EFDB;">
          ${body}
        </td></tr>
        <tr><td style="padding:26px 40px;border-top:1px solid rgba(247,239,219,0.12);font-family:Montserrat,Helvetica,Arial,sans-serif;">
          <p style="margin:0;font-size:12px;line-height:1.7;letter-spacing:0.03em;color:rgba(247,239,219,0.45);">
            Ascndr · Consultoría creativa<br>
            <a href="${SITE}" style="color:rgba(247,239,219,0.7);text-decoration:none;">ascndrworld.com</a>
            &nbsp;·&nbsp;
            <a href="${IG}" style="color:rgba(247,239,219,0.7);text-decoration:none;">Instagram</a>
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
    <div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(247,239,219,0.45);margin:0 0 4px;">${label}</div>
    <div style="font-size:16px;line-height:1.5;color:#F7EFDB;">${value}</div>
  </td></tr>`;
}

const BTN = "display:inline-block;background:#F7EFDB;color:#000000;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;padding:14px 30px;";

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
    <div style="font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(247,239,219,0.5);margin:0 0 8px;">Nuevo contacto</div>
    <h1 style="margin:0 0 30px;font-size:26px;font-weight:800;letter-spacing:-0.5px;color:#F7EFDB;">Tienes un mensaje nuevo</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${field("Nombre", esc(name))}
      ${field("Email", `<a href="mailto:${esc(email)}" style="color:#F7EFDB;text-decoration:underline;">${esc(email)}</a>`)}
      ${field("Dónde está", esc(phone) || "No facilitado")}
      ${field("Proyecto", esc(consulta).replace(/\n/g, "<br>") || "Sin consulta previa")}
    </table>
    <a href="mailto:${esc(email)}" style="${BTN}margin-top:10px;">Responder a ${esc(name)}</a>`);

  const autoHtml = shell(`
    <h1 style="margin:0 0 22px;font-size:28px;font-weight:800;letter-spacing:-0.5px;color:#F7EFDB;">Gracias, ${esc(name)}</h1>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:rgba(247,239,219,0.85);">Hemos recibido tu mensaje y lo estamos revisando. Te responderemos personalmente en <strong style="color:#F7EFDB;">menos de 24 horas</strong>.</p>
    <p style="margin:30px 0 0;font-size:15px;line-height:1.6;color:rgba(247,239,219,0.85);">Un saludo,<br><strong style="color:#F7EFDB;">Frank</strong> · Ascndr</p>`);

  // 1) Aviso a ti (obligatorio) — responder va directo al cliente
  try {
    await sendEmail({
      from: FROM_NOTIFY,
      to: [OWNER_EMAIL],
      reply_to: email,
      subject: `Nuevo contacto: ${name}`,
      html: notifyHtml,
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
    });
  } catch (err) {
    console.warn("Auto-respuesta no enviada:", err);
  }

  return json(200, { ok: true });
};
