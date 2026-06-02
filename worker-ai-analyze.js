// Cloudflare Worker for LaoCreditAssist AI Analyze
// Add secret variable in Cloudflare Worker Settings:
// ANTHROPIC_API_KEY = your Claude API key

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === "GET") {
      return new Response(JSON.stringify({ ok: true, message: "AI Worker is running. Use POST with { prompt }." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      if (!env.ANTHROPIC_API_KEY) {
        return new Response(JSON.stringify({ error: "Missing ANTHROPIC_API_KEY secret" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await request.json();
      const prompt = body.prompt;

      if (!prompt) {
        return new Response(JSON.stringify({ error: "Missing prompt" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 900,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return new Response(JSON.stringify({ error: data }), {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const text = data?.content?.[0]?.text || "";
      return new Response(JSON.stringify({ result: text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
