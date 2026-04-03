import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STRONG_AI_KEYWORDS = [
  "ai generated", "dall-e", "midjourney", "stable diffusion",
  "synthetic", "cgi", "render", "3d rendering",
];

const REAL_IMAGE_KEYWORDS = [
  "person", "face", "human", "portrait", "skin", "photo", "camera",
  "selfie", "photograph", "people", "man", "woman", "child",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { image, mimeType } = await req.json();
    if (!image) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mime = mimeType || "image/jpeg";

    const systemPrompt = `You are an image analysis AI. Analyze the provided image and return a JSON response with EXACTLY this structure (no markdown, no code fences, just raw JSON):

{
  "rawAiConfidence": number (0-100),
  "isSensitive": boolean,
  "sensitiveCategories": {
    "adult": "VERY_UNLIKELY" | "UNLIKELY" | "POSSIBLE" | "LIKELY" | "VERY_LIKELY",
    "violence": "VERY_UNLIKELY" | "UNLIKELY" | "POSSIBLE" | "LIKELY" | "VERY_LIKELY",
    "racy": "VERY_UNLIKELY" | "UNLIKELY" | "POSSIBLE" | "LIKELY" | "VERY_LIKELY",
    "medical": "VERY_UNLIKELY" | "UNLIKELY" | "POSSIBLE" | "LIKELY" | "VERY_LIKELY"
  },
  "labels": ["label1", "label2", ...]
}

Rules:
- rawAiConfidence: your confidence that the image is AI-generated/synthetic/deepfake (0-100). Look for: unnatural textures, inconsistent lighting, artifacts, too-perfect skin, distorted hands/fingers, blurred backgrounds that don't match, text errors, uncanny valley effects.
- Be conservative: real photographs of people should get LOW rawAiConfidence (under 30). Only give high confidence if you see clear synthetic artifacts.
- isSensitive: true ONLY if adult, violence, or racy is LIKELY or VERY_LIKELY.
- sensitiveCategories: rate each category independently.
- labels: up to 10 descriptive labels for the image content. Use simple lowercase words.

Return ONLY the JSON object, nothing else.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this image for AI-generation detection and sensitive content." },
              {
                type: "image_url",
                image_url: { url: `data:${mime};base64,${image}` },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errBody = await response.text();
      throw new Error(`AI Gateway error [${response.status}]: ${errBody}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI model");
    }

    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const raw = JSON.parse(jsonStr);

    // Apply balanced decision logic
    const labels = (raw.labels || []).map((l: string) => l.toLowerCase());
    const rawConfidence = raw.rawAiConfidence ?? 50;

    // Count strong AI keyword matches
    const aiMatches = STRONG_AI_KEYWORDS.filter(kw =>
      labels.some((l: string) => l.includes(kw))
    ).length;

    // Check for real image indicators
    const hasRealIndicators = REAL_IMAGE_KEYWORDS.some(kw =>
      labels.some((l: string) => l.includes(kw))
    );

    // Balanced decision: AI only if strong evidence
    let isAiGenerated = false;
    let aiConfidence = rawConfidence;

    if (aiMatches >= 2 && rawConfidence >= 70) {
      isAiGenerated = true;
      aiConfidence = rawConfidence;
    } else if (hasRealIndicators) {
      // Real image indicators present, reduce confidence
      isAiGenerated = false;
      aiConfidence = Math.min(rawConfidence, 30);
    } else if (rawConfidence >= 85 && aiMatches >= 1) {
      // Very high confidence with at least one AI indicator
      isAiGenerated = true;
    } else {
      isAiGenerated = false;
      aiConfidence = rawConfidence;
    }

    const uploadAllowed = !isAiGenerated && !raw.isSensitive;
    const message = raw.isSensitive
      ? "Sensitive or harmful content detected"
      : isAiGenerated
        ? "Upload failed: AI-generated images are not allowed"
        : "Real Human Image";

    const result = {
      isAiGenerated,
      aiConfidence,
      isSensitive: raw.isSensitive ?? false,
      sensitiveCategories: raw.sensitiveCategories,
      labels: raw.labels || [],
      uploadAllowed,
      message,
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
