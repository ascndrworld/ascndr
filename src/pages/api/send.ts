import type { APIRoute } from "astro";
import { Resend } from "resend";

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const email = url.searchParams.get("email") ?? "";
  const tipo  = url.searchParams.get("tipo")  ?? "";
  const web   = url.searchParams.get("web")   ?? "";

  console.log("[send] params →", { email, tipo, web });

  if (!email) {
    return new Response(JSON.stringify({ error: "email requerido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const data = await resend.emails.send({
      from: "web@ascndrworld.com",
      to:   "frank@ascndrworld.com",
      subject: `Nueva consulta desde Ascndr — ${tipo || "web"}`,
      html: `
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Tipo:</strong> ${tipo}</p>
        <p><strong>Web:</strong> ${web}</p>
      `,
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
