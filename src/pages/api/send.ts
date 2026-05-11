import type { APIRoute } from "astro";
import { Resend } from "resend";

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export const POST: APIRoute = async ({ request }) => {
  let email = "", tipo = "", web = "";

  try {
    const raw = await request.text();
    console.log("[send] raw body:", raw);

    if (raw && raw.startsWith("{")) {
      const parsed = JSON.parse(raw);
      email = parsed.email ?? "";
      tipo  = parsed.tipo  ?? "";
      web   = parsed.web   ?? "";
    } else if (raw) {
      const params = new URLSearchParams(raw);
      email = params.get("email") ?? "";
      tipo  = params.get("tipo")  ?? "";
      web   = params.get("web")   ?? "";
    }
  } catch (e) {
    console.error("[send] parse error:", e);
  }

  console.log("[send] parsed →", { email, tipo, web });

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

    console.log("[send] resend ok:", data);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[send] resend error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
