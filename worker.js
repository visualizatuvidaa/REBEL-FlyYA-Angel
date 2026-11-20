const MODEL = "gpt-4.1-mini";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/coach") {
      if (request.method !== "POST") {
        return json({ error: "POST required" }, 405);
      }

      if (!env.OPENAI_API_KEY) {
        return json({ error: "OpenAI API key not configured" }, 503);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      if (!body || typeof body !== "object" || Array.isArray(body) ||
          typeof body.message !== "string") {
        return json({ error: "Invalid message" }, 400);
      }

      const message = body.message.trim();
      if (!message || message.length > 1200) {
        return json({ error: "Invalid message" }, 400);
      }

      try {
        const topic = (typeof body.topic === "string" ? body.topic : "music").slice(0, 80);
        const history = Array.isArray(body.history)
          ? body.history.slice(-8).filter(m =>
              m && ["user", "assistant"].includes(m.role) &&
              typeof m.content === "string"
            ).map(m => ({
              role: m.role,
              content: m.content.slice(0, 1500)
            }))
          : [];


        const response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.OPENAI_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: MODEL,
              messages: [
                {
                  role: "system",
                  content:
                    "You are FlyYA, Ángel's interactive music tutor in REBEL. " +
                    "Always respond in English. Teach hardcore punk, metal, " +
                    "drums, guitar, bass, songwriting and music theory. " +
                    "Current topic: " + topic + ". " +
                    "Give one short lesson or practical exercise at a time. " +
                    "Ask one question and wait for the student's response. " +
                    "Offer constructive feedback. Never claim to hear audio " +
                    "unless audio was actually received and analyzed."
                },
                ...history,
                { role: "user", content: message }
              ],
              max_completion_tokens: 550
            })
          }
        );

        if (!response.ok) {
          return json({
            error: "OpenAI request failed",
            status: response.status
          }, 502);
        }

        const data = await response.json();
        return json({
          reply: data.choices?.[0]?.message?.content ||
            "Please try again."
        });
      } catch {
        return json({ error: "Coach service unavailable" }, 502);
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "API route not found" }, 404);
    }

    if (env.ASSETS?.fetch) {
      return env.ASSETS.fetch(request);
    }

    return json({ error: "Static assets unavailable" }, 503);
  }
};
