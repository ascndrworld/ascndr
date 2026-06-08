// ── Dossier + borrador de respuesta con Claude ─────────────────────────────
// Flujo gobernado desde Telegram (ver src/pages/api/telegram.ts):
//   1) Lead → aviso con botones (gratis).
//   2) "Investigar" → runDossier(): Claude + búsqueda web → dossier a Telegram.
//   3) "Redactar respuesta" → runReply(): Claude redacta el borrador de email.
// El gasto de API solo ocurre cuando el dueño pulsa un botón (control de coste).

export interface Lead {
  name: string;
  email: string;
  phone: string;   // "Dónde está" (ubicación) del formulario
  consulta: string;
}

export interface DossierConfig {
  anthropicKey?: string;
  telegramToken?: string;
  telegramChatId?: string;
}

const MODEL = "claude-sonnet-4-6";
const TG_LIMIT = 3800; // margen bajo el tope de 4096 de Telegram

export interface InlineKeyboard {
  inline_keyboard: { text: string; callback_data: string }[][];
}

// Botones reutilizables
export const BTN_DRAFT: InlineKeyboard = {
  inline_keyboard: [[{ text: "✍️ Redactar respuesta", callback_data: "draft" }]],
};

// Trocea y envía a Telegram en texto plano (sin parse_mode: robusto ante la
// salida del modelo). El reply_markup (botones) se adjunta solo al último trozo.
async function sendTelegram(
  token: string,
  chatId: string,
  text: string,
  replyMarkup?: InlineKeyboard
) {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > TG_LIMIT) {
    let cut = rest.lastIndexOf("\n", TG_LIMIT);
    if (cut < 1000) cut = TG_LIMIT;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  chunks.push(rest);

  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: chunks[i],
      disable_web_page_preview: true,
    };
    if (isLast && replyMarkup) body.reply_markup = replyMarkup;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Telegram ${res.status}: ${detail}`);
    }
  }
}

async function callClaude(key: string, prompt: string, useWebSearch: boolean): Promise<string> {
  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  };
  if (useWebSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${detail}`);
  }

  const data: any = await res.json();
  return (data.content || [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();
}

function dossierPrompt(lead: Lead): string {
  return [
    "Eres el asistente de Ascndr, una consultoría creativa de Jaén (España): branding,",
    "diseño, dirección creativa y gestión de redes. Acaba de entrar este lead por el",
    "formulario de la web y Frank va a responderle. Prepárale un dossier para contextualizar.",
    "",
    `- Nombre: ${lead.name}`,
    `- Email: ${lead.email}`,
    `- Ubicación indicada: ${lead.phone || "no indicada"}`,
    `- Consulta: ${lead.consulta || "no indicada"}`,
    "",
    "Investiga con BÚSQUEDA WEB únicamente información PÚBLICA y PROFESIONAL. Pistas:",
    "deduce la empresa por el dominio del email si no es genérico (gmail, hotmail, outlook…),",
    "busca su web, perfiles y redes de la MARCA (Instagram, LinkedIn, etc.), sector, ubicación,",
    "y prensa o eventos locales relevantes. No inventes: si algo no se encuentra, dilo claramente.",
    "No incluyas datos personales sensibles ni especulaciones intrusivas sobre la persona.",
    "",
    "Devuelve un dossier BREVE en español, en TEXTO PLANO (sin markdown ni asteriscos),",
    "con estas secciones (una o dos líneas cada una, incluye enlaces cuando los tengas):",
    "QUIÉN ES / EMPRESA",
    "PRESENCIA ONLINE",
    "CONTEXTO ÚTIL",
    "QUÉ QUIERE",
    "ÁNGULO DE RESPUESTA",
    "Máximo unas 250 palabras. Sé concreto y accionable.",
  ].join("\n");
}

function replyPrompt(name: string, dossier: string): string {
  return [
    "Eres Frank, de Ascndr (consultoría creativa de Jaén: branding, diseño, dirección",
    "creativa y gestión de redes). Vas a responder por email a un lead que escribió por el",
    "formulario de la web. Tienes este dossier de investigación previa:",
    "",
    "----- DOSSIER -----",
    dossier,
    "-------------------",
    "",
    "Redacta un BORRADOR de respuesta en español, cercano pero profesional, listo para",
    "enviar (TEXTO PLANO, sin markdown). Estructura:",
    `- Saludo personal a ${name}.`,
    "- Muestra natural de que entendéis su negocio/contexto (sin parecer que le has espiado).",
    "- 3 a 5 PUNTOS DE MEJORA concretos y detallados para su marca / identidad / presencia",
    "  online, basados en el estudio. Cada punto: qué mejorar y por qué le aporta.",
    "- Cómo lo abordaría Ascndr y propuesta de siguiente paso (una llamada breve).",
    "- Cierre y firma SOLO como 'Frank' (o 'Frank · Ascndr'). NO inventes email,",
    "  teléfono, web ni ningún dato de contacto.",
    "No prometas datos inventados. Tono humano, nada robótico. Máximo unas 280 palabras.",
  ].join("\n");
}

// 2) Genera el dossier (con búsqueda web) y lo envía a Telegram con el botón
//    "Redactar respuesta". No lanza: registra errores y avisa por Telegram.
export async function runDossier(lead: Lead, cfg: DossierConfig): Promise<void> {
  if (!cfg.telegramToken || !cfg.telegramChatId) return;
  if (!cfg.anthropicKey) {
    console.warn("Dossier omitido: falta ANTHROPIC_API_KEY.");
    return;
  }
  try {
    const dossier = await callClaude(cfg.anthropicKey, dossierPrompt(lead), true);
    const message = `🔎 DOSSIER · ${lead.name}\n\n${dossier || "(Sin contenido)"}`;
    await sendTelegram(cfg.telegramToken, cfg.telegramChatId, message, BTN_DRAFT);
  } catch (err) {
    console.error("Error generando/enviando el dossier:", err);
    try {
      await sendTelegram(
        cfg.telegramToken,
        cfg.telegramChatId,
        `⚠️ No se pudo generar el dossier de ${lead.name}.`
      );
    } catch { /* best-effort */ }
  }
}

// 3) Redacta el borrador de respuesta a partir del dossier y lo envía a Telegram.
export async function runReply(name: string, dossier: string, cfg: DossierConfig): Promise<void> {
  if (!cfg.telegramToken || !cfg.telegramChatId) return;
  if (!cfg.anthropicKey) {
    console.warn("Borrador omitido: falta ANTHROPIC_API_KEY.");
    return;
  }
  try {
    const draft = await callClaude(cfg.anthropicKey, replyPrompt(name, dossier), false);
    const message = `✍️ BORRADOR DE RESPUESTA · ${name}\n\n${draft || "(Sin contenido)"}`;
    await sendTelegram(cfg.telegramToken, cfg.telegramChatId, message);
  } catch (err) {
    console.error("Error generando/enviando el borrador:", err);
    try {
      await sendTelegram(
        cfg.telegramToken,
        cfg.telegramChatId,
        `⚠️ No se pudo generar el borrador de respuesta de ${name}.`
      );
    } catch { /* best-effort */ }
  }
}
