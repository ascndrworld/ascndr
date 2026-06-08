import type { APIRoute } from "astro";
import { waitUntil } from "@vercel/functions";
import { runDossier, runReply, type Lead } from "../../lib/dossier";

// Webhook de Telegram: recibe las pulsaciones de los botones del aviso de lead.
// El gasto de API (dossier / borrador) SOLO ocurre cuando el dueño pulsa un botón.
export const prerender = false;

const TELEGRAM_BOT_TOKEN =
  import.meta.env.TELEGRAM_BOT_TOKEN ??
  (globalThis as any).process?.env?.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID =
  import.meta.env.TELEGRAM_CHAT_ID ??
  (globalThis as any).process?.env?.TELEGRAM_CHAT_ID;
const ANTHROPIC_API_KEY =
  import.meta.env.ANTHROPIC_API_KEY ??
  (globalThis as any).process?.env?.ANTHROPIC_API_KEY;
const WEBHOOK_SECRET =
  import.meta.env.TELEGRAM_WEBHOOK_SECRET ??
  (globalThis as any).process?.env?.TELEGRAM_WEBHOOK_SECRET;

const cfg = () => ({
  anthropicKey: ANTHROPIC_API_KEY,
  telegramToken: TELEGRAM_BOT_TOKEN,
  telegramChatId: TELEGRAM_CHAT_ID,
});

const ok = () => new Response("ok", { status: 200 });

async function tg(method: string, payload: Record<string, unknown>) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

const noKeyboard = { inline_keyboard: [] as unknown[] };

// El texto del aviso (parse_mode HTML) llega aquí ya SIN etiquetas, por líneas:
//   👤 Nombre / ✉️ email / 📍 ubicación / 📝 Consulta\n…
function pick(lines: string[], emoji: string): string {
  const line = lines.find((l) => l.trimStart().startsWith(emoji));
  return line ? line.slice(line.indexOf(emoji) + emoji.length).trim() : "";
}
function parseLead(text: string): Lead {
  const lines = text.split("\n");
  let phone = pick(lines, "📍");
  if (phone === "—") phone = "";
  const idx = lines.findIndex((l) => l.includes("Consulta"));
  const consulta = idx >= 0 ? lines.slice(idx + 1).join("\n").trim() : "";
  return { name: pick(lines, "👤"), email: pick(lines, "✉️"), phone, consulta };
}

// El mensaje del dossier empieza por "🔎 DOSSIER · {nombre}" y debajo el texto.
function parseDossier(text: string): { name: string; dossier: string } {
  const lines = text.split("\n");
  const first = lines[0] || "";
  const name = first.includes("·") ? first.split("·").slice(1).join("·").trim() : "el cliente";
  return { name, dossier: lines.slice(1).join("\n").trim() };
}

function background(promise: Promise<unknown>) {
  try {
    waitUntil(promise);
  } catch {
    void (promise as Promise<unknown>).catch(() => {}); // dev local
  }
}

export const POST: APIRoute = async ({ request }) => {
  // 1) Seguridad: el secreto que Telegram añade en cada llamada
  if (WEBHOOK_SECRET) {
    const got = request.headers.get("x-telegram-bot-api-secret-token");
    if (got !== WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
  }

  let update: any;
  try {
    update = await request.json();
  } catch {
    return ok();
  }

  const cq = update.callback_query;
  if (!cq) return ok(); // solo nos interesan los botones

  // 2) Solo el dueño puede accionar
  if (TELEGRAM_CHAT_ID && String(cq.from?.id ?? "") !== String(TELEGRAM_CHAT_ID)) {
    await tg("answerCallbackQuery", { callback_query_id: cq.id, text: "No autorizado." });
    return ok();
  }

  const data: string = cq.data || "";
  const msg = cq.message || {};
  const chatId = msg.chat?.id;
  const messageId = msg.message_id;
  const text: string = msg.text || "";

  // Confirmamos la pulsación (quita el "reloj" del botón)
  await tg("answerCallbackQuery", { callback_query_id: cq.id });

  if (data === "dismiss") {
    await tg("editMessageText", {
      chat_id: chatId, message_id: messageId,
      text: `${text}\n\n✖️ Descartado.`, reply_markup: noKeyboard,
    });
    return ok();
  }

  if (data === "dossier") {
    const lead = parseLead(text);
    // Quitamos los botones para que no se pueda lanzar dos veces (doble gasto)
    await tg("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: noKeyboard });
    await tg("sendMessage", { chat_id: chatId, text: `⏳ Investigando a ${lead.name || "el cliente"}…` });
    background(runDossier(lead, cfg()));
    return ok();
  }

  if (data === "draft") {
    const { name, dossier } = parseDossier(text);
    await tg("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: noKeyboard });
    await tg("sendMessage", { chat_id: chatId, text: `⏳ Redactando respuesta para ${name}…` });
    background(runReply(name, dossier, cfg()));
    return ok();
  }

  return ok();
};
