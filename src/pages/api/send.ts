import type { APIRoute } from "astro";
import { Resend } from "resend";

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export const ALL: APIRoute = async ({ url }) => {
  const email    = url.searchParams.get("email")    ?? "";
  const nombre   = url.searchParams.get("nombre")   ?? "";
  const telefono = url.searchParams.get("telefono") ?? "";
  const consulta = url.searchParams.get("consulta") ?? "";
  const tipo     = url.searchParams.get("tipo")     ?? "";
  const web      = url.searchParams.get("web")      ?? "";

  if (!email) {
    return new Response(JSON.stringify({ error: "email requerido", url: url.toString() }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await resend.emails.send({
      from: "web@ascndrworld.com",
      to: "frank@ascndrworld.com",
      subject: `Nueva consulta — ${tipo || "web"} — Ascndr`,
      html: `
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Tipo:</strong> ${tipo || "—"}</p>
        <p><strong>Web:</strong> ${web || "—"}</p>
        <p><strong>Nombre:</strong> ${nombre || "—"}</p>
        <p><strong>Consulta:</strong> ${consulta || "—"}</p>
      `,
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
