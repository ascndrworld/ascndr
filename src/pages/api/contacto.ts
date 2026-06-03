import type { APIRoute } from "astro";

// Endpoint bajo demanda (serverless en Vercel); el resto del sitio sigue estático.
export const prerender = false;

// ── Config de remitentes/destinatario (cambia aquí si quieres otra dirección) ──
const OWNER_EMAIL = "frank@ascndrworld.com";              // a quién le llega el aviso
const FROM_NOTIFY = "Web Ascndr <frank@ascndrworld.com>"; // remitente del aviso
const FROM_REPLY  = "Ascndr <frank@ascndrworld.com>";     // remitente de la auto-respuesta

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

  const notifyHtml = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#111;line-height:1.6">
      <h2 style="margin:0 0 16px">Nuevo mensaje desde la web</h2>
      <p><strong>Nombre:</strong> ${esc(name)}</p>
      <p><strong>Email:</strong> ${esc(email)}</p>
      <p><strong>Dónde está:</strong> ${esc(phone) || "No facilitado"}</p>
      <p><strong>Proyecto:</strong><br>${esc(consulta).replace(/\n/g, "<br>") || "Sin consulta previa"}</p>
    </div>`;

  const autoHtml = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#111;line-height:1.6">
      <p>Hola ${esc(name)},</p>
      <p>Gracias por escribirnos. Hemos recibido tu mensaje y te responderemos en menos de 24h.</p>
      <p>Un saludo,<br>Frank · Ascndr</p>
    </div>`;

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
