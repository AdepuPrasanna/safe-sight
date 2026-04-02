import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Analyzes an image using Google Cloud Vision API for:
 * 1. SafeSearch detection (sensitive content)
 * 2. Label detection (used as heuristic for AI-generated detection)
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_CLOUD_VISION_API_KEY = Deno.env.get("GOOGLE_CLOUD_VISION_API_KEY");
    if (!GOOGLE_CLOUD_VISION_API_KEY) {
      throw new Error("GOOGLE_CLOUD_VISION_API_KEY is not configured");
    }

    const { image } = await req.json();
    if (!image) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Google Cloud Vision API
    const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_CLOUD_VISION_API_KEY}`;

    const visionResponse = await fetch(visionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: image },
            features: [
              { type: "SAFE_SEARCH_DETECTION" },
              { type: "LABEL_DETECTION", maxResults: 15 },
            ],
          },
        ],
      }),
    });

    if (!visionResponse.ok) {
      const errBody = await visionResponse.text();
      throw new Error(`Vision API error [${visionResponse.status}]: ${errBody}`);
    }

    const visionData = await visionResponse.json();
    const annotation = visionData.responses?.[0];

    if (!annotation) {
      throw new Error("No response from Vision API");
    }

    // Extract SafeSearch results
    const safeSearch = annotation.safeSearchAnnotation || {};
    const adult = safeSearch.adult || "UNKNOWN";
    const violence = safeSearch.violence || "UNKNOWN";
    const racy = safeSearch.racy || "UNKNOWN";
    const medical = safeSearch.medical || "UNKNOWN";

    // Determine if sensitive: block if any category is LIKELY or VERY_LIKELY
    const highRisk = ["LIKELY", "VERY_LIKELY"];
    const isSensitive =
      highRisk.includes(adult) ||
      highRisk.includes(violence) ||
      highRisk.includes(racy);

    // Extract labels
    const labels: string[] = (annotation.labelAnnotations || []).map(
      (l: { description: string }) => l.description
    );

    // Heuristic AI detection: check for labels suggesting AI generation
    const aiKeywords = [
      "artificial intelligence", "ai generated", "computer generated",
      "digital art", "cgi", "3d rendering", "synthetic", "generated",
      "deepfake", "neural network", "machine learning",
      "illustration", "graphic design", "render",
    ];

    const matchedAiLabels = labels.filter((l) =>
      aiKeywords.some((kw) => l.toLowerCase().includes(kw))
    );

    // Also check for very high-quality "perfect" images — common in AI art
    const isAiGenerated = matchedAiLabels.length >= 1;
    const aiConfidence = isAiGenerated
      ? Math.min(95, 60 + matchedAiLabels.length * 15)
      : Math.max(10, 85 - labels.length * 2);

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
