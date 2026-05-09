export const prerender = false;

import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';

export const POST: APIRoute = async ({ request }) => {
  let body: any = {};
  try {
    const text = await request.text();
    console.log('RAW BODY:', text);
    body = JSON.parse(text);
    console.log('PARSED BODY:', JSON.stringify(body));
  } catch(e) {
    console.log('PARSE ERROR:', e);
    return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 });
  }

  const { tipo, web, email, nombre, telefono, mensaje } = body;

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email requerido' }), { status: 400 });
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
    : 'Nuevo mensaje desde ascndrworld.com';

  const html = `
    <div style="font-family:sans-serif;max-width:520px;color:#111;">
      <h2 style="margin-bottom:4px;">${subject}</h2>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0;"/>
      ${tipo    ? `<p><strong>Tipo:</strong> ${tipo}</p>` : ''}
      ${nombre  ? `<p><strong>Nombre:</strong> ${nombre}</p>` : ''}
      ${telefono? `<p><strong>Teléfono:</strong> ${telefono}</p>` : ''}
      ${web     ? `<p><strong>Web / Instagram:</strong> ${web}</p>` : ''}
      ${mensaje ? `<p><strong>Mensaje:</strong> ${mensaje}</p>` : ''}
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
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error('SMTP error:', err);
    return new Response(JSON.stringify({ error: 'Error al enviar' }), { status: 500 });
  }
};
