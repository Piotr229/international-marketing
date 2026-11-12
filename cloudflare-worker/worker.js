/**
 * Cloudflare Worker Proxy for GlobalMark AI (Free Tier: 100,000 req/day)
 *
 * Environment Variables (set in Cloudflare Dashboard -> Worker -> Settings -> Variables & Secrets):
 * - GEMINI_API_KEY (Secret): Your Google AI Studio Gemini API key
 * - ALLOWED_ORIGIN (Text, optional): e.g. "https://yourusername.github.io"
 */
export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/api/chat") {
      return new Response(JSON.stringify({ error: { message: "Not Found" } }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: { message: "Server missing GEMINI_API_KEY secret." } }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    try {
      const body = await request.json();
      const model = typeof body.model === "string" && body.model.trim()
        ? body.model.trim()
        : "gemini-4-hydrogen";

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

      const upstream = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          systemInstruction: body.systemInstruction,
          contents: body.contents,
          generationConfig: body.generationConfig
        })
      });

      const responseText = await upstream.text();
      return new Response(responseText, {
        status: upstream.status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: { message: "Invalid request payload." } }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
