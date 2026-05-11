import type { APIRoute } from "astro";
import { Resend } from "resend";

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const email    = url.searchParams.get("email")    ?? "";
  const nombre   = url.searchParams.get("nombre")   ?? "";
  const telefono = url.searchParams.get("telefono") ?? "";
  const consulta = url.searchParams.get("consulta") ?? "";
  const tipo     = url.searchParams.get("tipo")     ?? "";
  const web      = url.searchParams.get("web")      ?? "";

  console.log("[send] params →", { email, nombre, telefono, consulta, tipo, web });

  if (!email) {
    return new Response(JSON.stringify({ error: "email requerido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const subject = nombre
    ? `Nueva consulta de ${nombre} — Ascndr`
    : `Nueva consulta desde Ascndr — ${tipo || "web"}`;

  const html = `
    <p><strong>Nombre:</strong> ${nombre || "—"}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Teléfono:</strong> ${telefono || "—"}</p>
    <p><strong>Consulta:</strong> ${consulta || tipo || "—"}</p>
    <p><strong>Web:</strong> ${web || "—"}</p>
  `;

  try {
    const data = await resend.emails.send({
      from: "web@ascndrworld.com",
      to:   "frank@ascndrworld.com",
      subject,
      html,
    });
    console.log("[send] ok:", data);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[send] error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
// searchParams fix
