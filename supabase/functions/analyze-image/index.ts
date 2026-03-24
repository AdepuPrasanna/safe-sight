import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_CLOUD_VISION_API_KEY = Deno.env.get("GOOGLE_CLOUD_VISION_API_KEY");
    if (!GOOGLE_CLOUD_VISION_API_KEY) {
      throw new Error("GOOGLE_CLOUD_VISION_API_KEY is not configured");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { image } = await req.json();
    if (!image) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Run Vision API (SafeSearch) and Gemini AI detection in parallel
    const [visionResult, aiResult] = await Promise.all([
      // 1. Google Cloud Vision for SafeSearch
      fetch(`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_CLOUD_VISION_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { content: image },
            features: [
              { type: "SAFE_SEARCH_DETECTION" },
              { type: "LABEL_DETECTION", maxResults: 10 },
            ],
          }],
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Vision API error: ${await r.text()}`);
        return r.json();
      }),

      // 2. Gemini for AI-generated detection
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this image and determine if it is AI-generated (by tools like DALL-E, Midjourney, Stable Diffusion, ChatGPT, etc.) or a real photograph taken by a camera.

Look for these AI-generation indicators:
- Unnatural skin textures, overly smooth or plastic-looking skin
- Inconsistent lighting or shadows
- Warped or malformed hands, fingers, ears, teeth
- Symmetric perfection that looks uncanny
- Blurred or nonsensical background details
- Text that is garbled or doesn't make sense
- Overly saturated or hyper-realistic quality
- Repetitive patterns or textures
- Lack of natural imperfections

Respond with ONLY a JSON object (no markdown, no code fences):
{"isAiGenerated": true/false, "confidence": 0-100, "reasoning": "brief explanation"}`
                },
                {
                  type: "image_url",
                  image_url: { url: `data:image/jpeg;base64,${image}` }
                }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 300,
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`AI Gateway error: ${await r.text()}`);
        return r.json();
      }),
    ]);

    // Parse Vision API results
    const annotation = visionResult.responses?.[0];
    if (!annotation) throw new Error("No response from Vision API");

    const safeSearch = annotation.safeSearchAnnotation || {};
    const adult = safeSearch.adult || "UNKNOWN";
    const violence = safeSearch.violence || "UNKNOWN";
    const racy = safeSearch.racy || "UNKNOWN";
    const medical = safeSearch.medical || "UNKNOWN";

    const highRisk = ["LIKELY", "VERY_LIKELY"];
    const isSensitive =
      highRisk.includes(adult) ||
      highRisk.includes(violence) ||
      highRisk.includes(racy);

    const labels: string[] = (annotation.labelAnnotations || []).map(
      (l: { description: string }) => l.description
    );

    // Parse Gemini AI detection result
    let isAiGenerated = false;
    let aiConfidence = 50;
    try {
      const aiContent = aiResult.choices?.[0]?.message?.content || "";
      const cleaned = aiContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      isAiGenerated = parsed.isAiGenerated === true;
      aiConfidence = Math.max(0, Math.min(100, parsed.confidence || 50));
    } catch (e) {
      console.error("Failed to parse AI detection response:", e);
    }

    const result = {
      isAiGenerated,
      aiConfidence,
      isSensitive,
      sensitiveCategories: { adult, violence, racy, medical },
      labels: labels.slice(0, 10),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Analysis error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});