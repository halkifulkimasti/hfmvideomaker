exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { action, engine, prompt, imageBase64, taskId, provider, speaker, lang, text } = body;

    // 1. START VIDEO GENERATION
    if (action === "start_video") {
      if (engine === "runway") {
        const key = (process.env.RUNWAY_API_KEY || "").trim();
        if (!key) return { statusCode: 400, body: JSON.stringify({ error: "RUNWAY_API_KEY is missing in Netlify." }) };

        const res = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "X-Runway-Version": "2024-11-06",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            promptImage: imageBase64,
            promptText: prompt,
            model: "gen3a_turbo",
            ratio: "768:1280",
            duration: 5
          })
        });
        const data = await res.json();
        if (!res.ok) return { statusCode: res.status, body: JSON.stringify({ error: JSON.stringify(data) }) };
        return { statusCode: 200, body: JSON.stringify({ taskId: data.id }) };
      }

      if (engine === "minimax") {
        const key = (process.env.MINIMAX_API_KEY || "").trim();
        if (!key) return { statusCode: 400, body: JSON.stringify({ error: "MINIMAX_API_KEY is missing in Netlify." }) };

        const payload = { model: "video-01", prompt };
        if (imageBase64) payload.first_frame_image = imageBase64;

        const res = await fetch("https://api.minimax.io/v1/video_generation", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!data.task_id) return { statusCode: 400, body: JSON.stringify({ error: JSON.stringify(data) }) };
        return { statusCode: 200, body: JSON.stringify({ taskId: data.task_id }) };
      }

      if (engine === "seedance") {
        const key = (process.env.SEEDANCE_API_KEY || "").trim();
        if (!key) return { statusCode: 400, body: JSON.stringify({ error: "SEEDANCE_API_KEY is missing in Netlify." }) };

        const content = [{ type: "text", text: `${prompt} --ratio 9:16 --dur 5` }];
        if (imageBase64) {
          content.push({ type: "image_url", image_url: { url: imageBase64 } });
        }

        const res = await fetch("https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ model: "seedance-1-0-pro-250528", content })
        });
        const data = await res.json();
        if (!data.id) return { statusCode: 400, body: JSON.stringify({ error: JSON.stringify(data) }) };
        return { statusCode: 200, body: JSON.stringify({ taskId: data.id }) };
      }
    }

    // 2. CHECK VIDEO STATUS
    if (action === "check_video") {
      if (engine === "runway") {
        const key = (process.env.RUNWAY_API_KEY || "").trim();
        const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
          headers: {
            "Authorization": `Bearer ${key}`,
            "X-Runway-Version": "2024-11-06"
          }
        });
        const data = await res.json();
        if (data.status === "SUCCEEDED") return { statusCode: 200, body: JSON.stringify({ status: "succeeded", videoUrl: data.output[0] }) };
        if (data.status === "FAILED") return { statusCode: 200, body: JSON.stringify({ status: "failed", error: data.failure }) };
        return { statusCode: 200, body: JSON.stringify({ status: "processing" }) };
      }

      if (engine === "minimax") {
        const key = (process.env.MINIMAX_API_KEY || "").trim();
        const headers = { "Authorization": `Bearer ${key}` };
        const res = await fetch(`https://api.minimax.io/v1/query/video_generation?task_id=${taskId}`, { headers });
        const data = await res.json();
        if (data.status === "Success") {
          const fRes = await fetch(`https://api.minimax.io/v1/files/retrieve?file_id=${data.file_id}`, { headers });
          const fData = await fRes.json();
          return { statusCode: 200, body: JSON.stringify({ status: "succeeded", videoUrl: fData?.file?.download_url }) };
        }
        if (data.status === "Fail") return { statusCode: 200, body: JSON.stringify({ status: "failed", error: JSON.stringify(data) }) };
        return { statusCode: 200, body: JSON.stringify({ status: "processing" }) };
      }

      if (engine === "seedance") {
        const key = (process.env.SEEDANCE_API_KEY || "").trim();
        const res = await fetch(`https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/${taskId}`, {
          headers: { "Authorization": `Bearer ${key}` }
        });
        const data = await res.json();
        if (data.status === "succeeded") return { statusCode: 200, body: JSON.stringify({ status: "succeeded", videoUrl: data?.content?.video_url }) };
        if (data.status === "failed") return { statusCode: 200, body: JSON.stringify({ status: "failed", error: JSON.stringify(data) }) };
        return { statusCode: 200, body: JSON.stringify({ status: "processing" }) };
      }
    }

    // 3. GENERATE STUDIO VOICE
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
            audioDataUri: `data:audio/wav;base64,${data.audios[0]}`,
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
            audioDataUri: `data:audio/mpeg;base64,${b64}`,
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
