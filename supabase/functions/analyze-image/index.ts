import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_KEYWORDS = [
  "ai generated", "chatgpt", "dall-e", "dall e", "midjourney", "stable diffusion",
  "synthetic", "cgi", "render", "digital art", "generated image",
  "computer generated", "3d render", "ai art", "generative", "neural",
  "deepfake", "machine generated",
];

const REAL_KEYWORDS = [
  "person", "face", "human", "skin", "portrait", "photo", "camera",
  "selfie", "people", "man", "woman", "child", "girl", "boy",
  "photograph", "snapshot",
];

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

    // Run Vision API and Gemini AI detection in parallel (Vision is optional)
    const [visionResult, aiResult] = await Promise.all([
      fetch(`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_CLOUD_VISION_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { content: image },
            features: [
              { type: "SAFE_SEARCH_DETECTION" },
              { type: "LABEL_DETECTION", maxResults: 20 },
            ],
          }],
        }),
      }).then(async (r) => {
        if (!r.ok) {
          console.warn(`Vision API failed: ${r.status}`);
          return null;
        }
        return r.json();
      }).catch((e) => {
        console.warn("Vision API error:", e);
        return null;
      }),

      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            {
              role: "system",
              content: `You are an expert forensic image analyst specializing in detecting AI-generated images. You have extensive experience identifying outputs from DALL-E 3, ChatGPT image generation, Midjourney, Stable Diffusion, Flux, and other generative AI tools.`
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this image carefully to determine if it is AI-generated or a real photograph.

Look for these AI-GENERATED indicators:
1. Unnaturally perfect textures, skin, hair
2. Smooth/circular bokeh patterns
3. Perfect lighting in casual scenes
4. Lack of natural camera sensor noise/grain
5. Background elements that dissolve or look abstract
6. Subtle anatomical issues (hands, fingers, teeth)
7. Overly vivid/saturated colors
8. "Too perfect" composition

Also look for REAL photograph indicators:
1. Natural sensor noise/grain
2. Imperfect composition
3. Natural skin texture with pores
4. Realistic lighting inconsistencies
5. Natural motion blur or focus issues

Respond with ONLY a JSON object (no markdown, no code fences):
{"isAiGenerated": true/false, "confidence": 0-100, "reasoning": "brief explanation", "safeSearch": {"adult": "UNLIKELY", "violence": "UNLIKELY", "racy": "UNLIKELY"}}`
                },
                {
                  type: "image_url",
                  image_url: { url: `data:image/jpeg;base64,${image}` }
                }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 500,
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`AI Gateway error: ${await r.text()}`);
        return r.json();
      }),
    ]);

    // Parse Vision API results (may be null if API is unavailable)
    const annotation = visionResult?.responses?.[0];

    let safeSearch: Record<string, string> = {};
    let labels: string[] = [];

    if (annotation) {
      safeSearch = annotation.safeSearchAnnotation || {};
      labels = (annotation.labelAnnotations || []).map(
        (l: { description: string }) => l.description
      );
    }

    const adult = safeSearch.adult || "UNKNOWN";
    const violence = safeSearch.violence || "UNKNOWN";
    const racy = safeSearch.racy || "UNKNOWN";
    const medical = safeSearch.medical || "UNKNOWN";

    const highRisk = ["LIKELY", "VERY_LIKELY"];
    const isSensitive =
      highRisk.includes(adult) ||
      highRisk.includes(violence) ||
      highRisk.includes(racy);

    // Count AI-related and real-world keyword matches
    const labelsLower = labels.map((l) => l.toLowerCase());
    const labelsJoined = labelsLower.join(" ");
    const aiMatches = AI_KEYWORDS.filter((kw) => labelsJoined.includes(kw)).length;
    const realMatches = REAL_KEYWORDS.filter((kw) => labelsLower.some((l) => l.includes(kw))).length;
    const keywordMatch = aiMatches >= 2;

    // Parse Gemini AI detection result
    let geminiDetected = false;
    let aiConfidence = 30;
    let reasoning = "";
    let geminiSafeSearch: Record<string, string> = {};
    try {
      const aiContent = aiResult.choices?.[0]?.message?.content || "";
      const cleaned = aiContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      geminiDetected = parsed.isAiGenerated === true;
      aiConfidence = Math.max(0, Math.min(100, parsed.confidence || 30));
      reasoning = parsed.reasoning || "";
      if (parsed.safeSearch) geminiSafeSearch = parsed.safeSearch;
    } catch (e) {
      console.error("Failed to parse AI detection response:", e);
      geminiDetected = false;
      aiConfidence = 30;
      reasoning = "Could not parse AI detection response; treating as real.";
    }

    // Use Gemini safeSearch as fallback if Vision API was unavailable
    const finalAdult = adult !== "UNKNOWN" ? adult : (geminiSafeSearch.adult || "UNKNOWN");
    const finalViolence = violence !== "UNKNOWN" ? violence : (geminiSafeSearch.violence || "UNKNOWN");
    const finalRacy = racy !== "UNKNOWN" ? racy : (geminiSafeSearch.racy || "UNKNOWN");
    const finalSensitive = !annotation ? false : isSensitive;

    // BALANCED DETECTION
    let isAiGenerated = false;
    if (aiConfidence >= 70) {
      isAiGenerated = true;
    } else if (keywordMatch && realMatches <= aiMatches) {
      isAiGenerated = true;
    }

    const finalConfidence = aiConfidence;
    const uploadAllowed = !isAiGenerated && !finalSensitive;

    let message = "";
    if (isAiGenerated) {
      message = "Upload failed: AI-generated images are not allowed.";
    } else if (finalSensitive) {
      message = "Upload failed: Sensitive or harmful content detected.";
    }

    const result = {
      isAiGenerated,
      aiConfidence: finalConfidence,
      reasoning,
      uploadAllowed,
      message,
      isSensitive: finalSensitive,
      sensitiveCategories: { adult: finalAdult, violence: finalViolence, racy: finalRacy, medical },
      labels: labels.slice(0, 10),
      keywordMatch,
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
