import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STRONG_AI_KEYWORDS = [
  "ai generated", "dall-e", "midjourney", "stable diffusion",
  "synthetic", "cgi", "render", "3d render", "3d rendering",
];

const REAL_IMAGE_KEYWORDS = [
  "person", "face", "human", "portrait", "photo", "camera",
];

const DEFAULT_SENSITIVE_CATEGORIES = {
  adult: "VERY_UNLIKELY",
  violence: "VERY_UNLIKELY",
  racy: "VERY_UNLIKELY",
  medical: "VERY_UNLIKELY",
} as const;

type RawAnalysis = {
  rawAiConfidence?: number;
  anomalyScore?: number;
  isSensitive?: boolean;
  sensitiveCategories?: Partial<typeof DEFAULT_SENSITIVE_CATEGORIES>;
  labels?: string[];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const normalizeConfidence = (value: unknown, fallback = 50) => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return clamp(Math.round(numeric), 0, 100);
};

const normalizeAnomalyScore = (value: unknown, rawConfidence: number) => {
  const numeric = typeof value === "number" ? value : Number(value);

  if (Number.isFinite(numeric)) {
    return clamp(Math.round(numeric), 0, 3);
  }

  if (rawConfidence >= 85) return 3;
  if (rawConfidence >= 70) return 2;
  if (rawConfidence >= 55) return 1;
  return 0;
};

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
  "anomalyScore": number (integer 0-3),
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
- anomalyScore: integer 0-3 based on visible AI artifacts. 0 = none, 1 = slight uncertainty, 2 = noticeable anomalies, 3 = obvious synthetic artifacts.
- Be conservative: real photographs of people should get LOW rawAiConfidence (under 30). Only give high confidence if you see clear synthetic artifacts or strong AI-generation cues.
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
    const raw = JSON.parse(jsonStr) as RawAnalysis;

    const labels = Array.isArray(raw.labels)
      ? raw.labels
        .map((label) => String(label).trim().toLowerCase())
        .filter(Boolean)
      : [];

    const rawConfidence = normalizeConfidence(raw.rawAiConfidence, 50);
    const anomalyScore = normalizeAnomalyScore(raw.anomalyScore, rawConfidence);

    const aiMatches = STRONG_AI_KEYWORDS.filter((keyword) =>
      labels.some((label) => label.includes(keyword))
    ).length;

    const realMatches = REAL_IMAGE_KEYWORDS.filter((keyword) =>
      labels.some((label) => label.includes(keyword))
    ).length;

    const hasStrongAiKeyword = aiMatches > 0;
    const hasRealIndicators = realMatches > 0;

    const aiScore = aiMatches * 2 + anomalyScore;
    const realScore = realMatches * 2;

    const canOverrideRealPriority = rawConfidence >= 60 || anomalyScore >= 2 || !hasRealIndicators;

    let isAiGenerated = false;
    let decisionReason = "insufficient_ai_evidence";

    if (aiMatches >= 2) {
      isAiGenerated = true;
      decisionReason = "multiple_ai_matches";
    } else if (hasStrongAiKeyword && canOverrideRealPriority) {
      isAiGenerated = true;
      decisionReason = hasRealIndicators ? "keyword_and_confidence" : "direct_keyword_match";
    } else if (aiScore > realScore && canOverrideRealPriority) {
      isAiGenerated = true;
      decisionReason = "score_based_ai";
    } else if (hasRealIndicators) {
      isAiGenerated = false;
      decisionReason = "real_priority";
    }

    let confidence = 50;

    if (isAiGenerated) {
      const highAiEvidence = hasStrongAiKeyword || anomalyScore >= 2 || aiMatches >= 2;

      confidence = highAiEvidence
        ? clamp(
          Math.round(
            72 + (aiMatches * 5) + (anomalyScore * 4) + (Math.max(rawConfidence - 60, 0) * 0.15) - (realMatches * 3),
          ),
          70,
          95,
        )
        : clamp(
          Math.round(
            48 + (aiMatches * 4) + (anomalyScore * 5) + (Math.max(rawConfidence - 45, 0) * 0.1) - (realMatches * 2),
          ),
          40,
          60,
        );
    } else if (hasRealIndicators) {
      confidence = clamp(
        Math.round(
          80 + (realMatches * 4) + (Math.max(55 - rawConfidence, 0) * 0.12) - (aiMatches * 3) - (anomalyScore * 2),
        ),
        75,
        95,
      );
    } else {
      confidence = clamp(
        Math.round(50 + (realScore * 3) - (aiScore * 2)),
        40,
        60,
      );
    }

    const uploadAllowed = !(isAiGenerated && confidence >= 65);
    const message = uploadAllowed
      ? "Real Human Image"
      : "Upload failed: AI-generated images are not allowed";

    const sensitiveCategories = {
      ...DEFAULT_SENSITIVE_CATEGORIES,
      ...(raw.sensitiveCategories ?? {}),
    };

    console.log("Detection summary:", JSON.stringify({
      labels,
      aiMatches,
      realMatches,
      anomalyScore,
      aiScore,
      realScore,
      rawConfidence,
      confidence,
      decisionReason,
      finalDecision: isAiGenerated ? "AI" : "REAL",
      uploadAllowed,
    }));

    const result = {
      isAiGenerated,
      confidence,
      isSensitive: raw.isSensitive ?? false,
      sensitiveCategories,
      labels,
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
