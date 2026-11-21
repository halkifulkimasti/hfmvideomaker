exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { action, provider, speaker, lang, text } = body;

    if (action === "voice") {
      if (provider === "sarvam") {
        const key = (process.env.SARVAM_API_KEY || "").trim();
        if (!key) return { statusCode: 400, body: JSON.stringify({ error: "SARVAM_API_KEY is missing in Netlify." }) };

        const res = await fetch("https://api.sarvam.ai/text-to-speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-subscription-key": key
          },
          body: JSON.stringify({
            inputs: [text],
            target_language_code: lang || "hi-IN",
            speaker: speaker || "shubh",
            model: "bulbul:v3"
          })
        });
        const data = await res.json();
        if (!res.ok) return { statusCode: res.status, body: JSON.stringify({ error: JSON.stringify(data) }) };

        return {
          statusCode: 200,
          body: JSON.stringify({
            audioBase64: data.audios[0],
            ext: "wav"
          })
        };
      }

      if (provider === "elevenlabs") {
        const key = (process.env.ELEVENLABS_API_KEY || "").trim();
        if (!key) return { statusCode: 400, body: JSON.stringify({ error: "ELEVENLABS_API_KEY is missing in Netlify." }) };

        const vid = speaker || "pNInz6obpgDQGcFmaJgB";
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
          method: "POST",
          headers: {
            "xi-api-key": key,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2"
          })
        });
        if (!res.ok) {
          const errTxt = await res.text();
          return { statusCode: res.status, body: JSON.stringify({ error: errTxt }) };
        }
        const arrayBuf = await res.arrayBuffer();
        const b64 = Buffer.from(arrayBuf).toString("base64");
        return {
          statusCode: 200,
          body: JSON.stringify({
            audioBase64: b64,
            ext: "mp3"
          })
        };
      }
    }

    return { statusCode: 400, body: JSON.stringify({ error: "Invalid action" }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
