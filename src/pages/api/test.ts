import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ url }) => {
  return new Response(JSON.stringify({ 
    ok: true, 
    email: url.searchParams.get("email"),
    url: url.toString()
  }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};
