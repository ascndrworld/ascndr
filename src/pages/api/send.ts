import type { APIRoute } from "astro";
import { Resend } from "resend";

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export const GET: APIRoute = async ({ url }) => {
  const email    = url.searchParams.get("email")    ?? "";
  const nombre   = url.searchParams.get("nombre")   ?? "";
  const telefono = url.searchParams.get("telefono") ?? "";
  const consulta = url.searchParams.get("consulta") ?? "";
  const tipo     = url.searchParams.get("tipo")     ?? "";
  const web      = url.searchParams.get("web")      ?? "";

  if (!email) {
    return new Response(JSON.stringify({ error: "email requerido" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const tipoRaw = tipo || consulta || "tu proyecto";
  const tipoLabel = tipoRaw.startsWith("noselo") || tipoRaw.startsWith("No sé")
    ? "orientación"
    : tipoRaw;

  const textoOrientacion = consulta.startsWith("No sé / orientación:")
    ? consulta.replace("No sé / orientación:", "").trim()
    : "";

  const htmlInterno = `
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Tipo:</strong> ${tipo || "—"}</p>
    <p><strong>Web:</strong> ${web || "—"}</p>
    ${textoOrientacion ? `<p><strong>Mensaje:</strong> ${textoOrientacion}</p>` : ""}
  `;

  const htmlCliente = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#000000;">

  <table style="background-color:#000000;margin:0;padding:0;" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td style="padding:40px 20px;font-family:'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif;" align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:30px;" align="center">
              <img style="width:150px;max-width:150px;height:auto;display:block;border:0;" src="https://www.ascndrworld.com/ascndr-logo.png" alt="Ascndr" width="150" />
            </td>
          </tr>
          <tr>
            <td>
              <p style="margin:0 0 20px 0;font-family:'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:20px;font-weight:600;letter-spacing:-0.02em;line-height:1.3;color:#fffff8;">
                Hola,
              </p>
              <p style="margin:0 0 16px 0;font-family:'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#a1a1aa;">
                Hemos recibido tu consulta sobre <span style="color:#fffff8;font-weight:600;">«${tipoLabel}»</span> y ya está en nuestras manos.
              </p>
              <p style="margin:0 0 16px 0;font-family:'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#a1a1aa;">
                Estamos analizando tu perfil y tus redes para preparar un diagnóstico a medida. En menos de <span style="color:#fffff8;font-weight:600;">24 horas</span> te enviaremos un resumen personalizado con los puntos clave donde vemos potencial para mejorar tu proyecto.
              </p>
              <p style="margin:0 0 8px 0;font-family:'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#a1a1aa;">
                Hablamos pronto,
              </p>
              <p style="margin:0;font-family:'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;">
                <span style="color:#fffff8;font-weight:600;">Frank</span><br/>
                <span style="color:#71717a;">Consultor Estratégico</span>
              </p>
              <table style="margin-top:40px;" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="border-top:1px solid #18181b;padding-top:20px;font-family:'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;text-align:center;line-height:1.6;" align="center">
                    <p style="margin:0;">
                      <span style="color:#3f3f46;">© 2026 ASCNDR. Todos los derechos reservados.<br/>Recibes este correo porque nos escribiste a través de </span><a target="_blank" href="https://ascndrworld.com" style="color:#52525b;text-decoration:none;">ascndrworld.com</a><span style="color:#3f3f46;">.<br/></span>
                      <a target="_blank" href="https://ascndrworld.com/privacidad" style="color:#52525b;text-decoration:underline;">Política de privacidad</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: "Ascndr <web@ascndrworld.com>",
      to: "franmadi10@gmail.com",
      subject: `Nueva consulta — ${tipoLabel} — Ascndr`,
      html: htmlInterno,
    });

    await resend.emails.send({
      from: "Frank <frank@ascndrworld.com>",
      to: email,
      reply_to: "frank@ascndrworld.com",
      subject: "Bienvenido a Ascndr",
      reply_to: "frank@ascndrworld.com",
      html: htmlCliente,
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

export const POST: APIRoute = GET;
