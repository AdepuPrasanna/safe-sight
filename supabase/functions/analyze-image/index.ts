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

    // Run Vision API and Gemini AI detection in parallel
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
        if (!r.ok) throw new Error(`Vision API error: ${await r.text()}`);
        return r.json();
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
              content: `You are an expert forensic image analyst specializing in detecting AI-generated images. You have extensive experience identifying outputs from DALL-E 3, ChatGPT image generation, Midjourney, Stable Diffusion, Flux, and other generative AI tools. You ALWAYS err on the side of flagging images as AI-generated. When in doubt, flag it as AI. Modern AI generators produce extremely realistic images, so you must be extremely vigilant and suspicious.`
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this image with EXTREME suspicion. Your default assumption should be that the image IS AI-generated unless you find overwhelming evidence it is a real photograph.

CRITICAL RULES:
- If there is ANY doubt, classify as AI-generated
- Modern AI (ChatGPT/DALL-E 3, Midjourney v6+) produces EXTREMELY realistic images
- Do NOT be fooled by realistic appearance - dig deeper
- A confidence of 50% or higher = AI-generated

AI-GENERATED indicators (even ONE weak indicator means AI-generated):
1. PERFECTION: Any unnaturally perfect textures, fur, skin, hair - too clean, too uniform
2. BOKEH: Smooth or circular bokeh patterns
3. LIGHTING: Perfect golden hour or studio-quality lighting in casual scenes
4. COMPOSITION: Well-centered subject, ideal framing
5. EYES: Clear/bright/perfect eyes, especially in animals
6. DEPTH OF FIELD: Smooth background blur
7. TEXTURES: Any ground/surface textures that look slightly off
8. ANATOMY: Any subtle anatomical issues
9. COLORS: Vivid, saturated, or warm color grading
10. OVERALL FEEL: Image looks "too good", "too cute", "too perfect"
11. NOISE: Lack of natural camera sensor noise/grain
12. DETAILS: Background elements that dissolve or look abstract
13. STYLE: Looks like stock photography, professional render, or digital art
14. METADATA: Any visual watermark patterns from AI tools

IMPORTANT: If the image has a "professional stock photo" quality or looks like it could be from an AI art portfolio, it IS AI-generated. Real casual photos have visible imperfections, noise, and imperfect composition.

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
          max_tokens: 500,
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

    // Check labels for AI-related keywords
    const labelsLower = labels.map((l) => l.toLowerCase()).join(" ");
    const keywordMatch = AI_KEYWORDS.some((kw) => labelsLower.includes(kw));

    // Parse Gemini AI detection result
    let geminiDetected = false;
    let aiConfidence = 50;
    let reasoning = "";
    try {
      const aiContent = aiResult.choices?.[0]?.message?.content || "";
      const cleaned = aiContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      geminiDetected = parsed.isAiGenerated === true;
      aiConfidence = Math.max(0, Math.min(100, parsed.confidence || 50));
      reasoning = parsed.reasoning || "";
    } catch (e) {
      console.error("Failed to parse AI detection response:", e);
      // On parse failure, err on the side of caution
      geminiDetected = true;
      aiConfidence = 75;
      reasoning = "Could not parse AI detection response; defaulting to AI-generated for safety.";
    }

    // STRICT DETECTION: AI-generated if ANY of these are true
    const isAiGenerated = geminiDetected || keywordMatch || aiConfidence >= 50;

    // If AI-generated, bump confidence to at least 50
    const finalConfidence = isAiGenerated ? Math.max(50, aiConfidence) : aiConfidence;

    // Determine if upload is allowed
    const uploadAllowed = !isAiGenerated && !isSensitive;

    let message = "";
    if (isAiGenerated) {
      message = "Upload failed: AI-generated images are not allowed.";
    } else if (isSensitive) {
      message = "Upload failed: Sensitive or harmful content detected.";
    }

    const result = {
      isAiGenerated,
      aiConfidence: finalConfidence,
      reasoning,
      uploadAllowed,
      message,
      isSensitive,
      sensitiveCategories: { adult, violence, racy, medical },
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
