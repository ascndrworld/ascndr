export const prerender = false;

import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  let body: any = {};

  try {
    const buf = await request.arrayBuffer();
    const text = new TextDecoder().decode(buf);
    if (text) body = JSON.parse(text);
  } catch { body = {}; }

  const { tipo, web, email, nombre, telefono, mensaje } = body;

  if (!email) {
    return new Response(
      JSON.stringify({ error: 'Email requerido' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const subject = tipo ? `Nueva consulta — ${tipo}`
    : nombre ? `Nuevo mensaje de ${nombre}`
    : 'Nuevo mensaje desde ascndrworld.com';

  const html = `
    <div style="font-family:sans-serif;max-width:520px;color:#111;">
      <h2>${subject}</h2>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0;"/>
      ${tipo     ? `<p><strong>Tipo:</strong> ${tipo}</p>` : ''}
      ${nombre   ? `<p><strong>Nombre:</strong> ${nombre}</p>` : ''}
      ${telefono ? `<p><strong>Teléfono:</strong> ${telefono}</p>` : ''}
      ${web      ? `<p><strong>Web / Instagram:</strong> ${web}</p>` : ''}
      ${mensaje  ? `<p><strong>Mensaje:</strong> ${mensaje}</p>` : ''}
      <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0;"/>
      <p style="font-size:12px;color:#888;">Enviado desde ascndrworld.com</p>
    </div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Ascndr Web <web@ascndrworld.com>',
        to: ['frank@ascndrworld.com'],
        reply_to: email,
        subject,
        html
      })
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: 'Resend error', detail: err }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Error', detail: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};
