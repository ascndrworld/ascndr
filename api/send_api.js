import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { tipo, web, email, nombre, telefono, mensaje } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: "Email requerido", received: Object.keys(req.body || {}) });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const subject = tipo
    ? `Nueva consulta — ${tipo}`
    : nombre
    ? `Nuevo mensaje de ${nombre}`
    : "Nuevo mensaje desde ascndrworld.com";

  const html = `
    <div style="font-family:sans-serif;max-width:520px;color:#111;">
      <h2>${subject}</h2>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0;"/>
      ${tipo     ? `<p><strong>Tipo:</strong> ${tipo}</p>` : ""}
      ${nombre   ? `<p><strong>Nombre:</strong> ${nombre}</p>` : ""}
      ${telefono ? `<p><strong>Teléfono:</strong> ${telefono}</p>` : ""}
      ${web      ? `<p><strong>Web / Instagram:</strong> ${web}</p>` : ""}
      ${mensaje  ? `<p><strong>Mensaje:</strong> ${mensaje}</p>` : ""}
      <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0;"/>
      <p style="font-size:12px;color:#888;">Enviado desde ascndrworld.com</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Ascndr Web" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      replyTo: email,
      subject,
      html,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("SMTP error:", err);
    return res.status(500).json({ error: "Error al enviar", detail: err.message });
  }
}
