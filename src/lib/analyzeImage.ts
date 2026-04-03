import { supabase } from "@/integrations/supabase/client";
import type { AnalysisResult } from "@/components/ResultsDashboard";

type RawAnalysisResponse = Partial<AnalysisResult> & {
  aiConfidence?: number;
};

const DEFAULT_SENSITIVE_CATEGORIES: AnalysisResult["sensitiveCategories"] = {
  adult: "VERY_UNLIKELY",
  violence: "VERY_UNLIKELY",
  racy: "VERY_UNLIKELY",
  medical: "VERY_UNLIKELY",
};

export async function analyzeImage(file: File): Promise<AnalysisResult> {
  const base64 = await fileToBase64(file);
  const mimeType = normalizeMimeType(file);

  const { data, error } = await supabase.functions.invoke("analyze-image", {
    body: { image: base64, mimeType },
  });

  if (error) {
    throw new Error(error.message || "Failed to analyze image");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  const response = (data ?? {}) as RawAnalysisResponse;

  return {
    isAiGenerated: Boolean(response.isAiGenerated),
    confidence: typeof response.confidence === "number"
      ? response.confidence
      : typeof response.aiConfidence === "number"
        ? response.aiConfidence
        : 50,
    isSensitive: Boolean(response.isSensitive),
    sensitiveCategories: {
      ...DEFAULT_SENSITIVE_CATEGORIES,
      ...(response.sensitiveCategories ?? {}),
    },
    labels: Array.isArray(response.labels) ? response.labels : [],
    uploadAllowed: Boolean(response.uploadAllowed),
    message: response.message || (response.uploadAllowed
      ? "Real Human Image"
      : "Upload failed: AI-generated images are not allowed"),
  };
}

function normalizeMimeType(file: File): "image/jpeg" | "image/png" {
  if (file.type === "image/png") {
    return "image/png";
  }

  if (file.type === "image/jpeg" || file.type === "image/jpg") {
    return "image/jpeg";
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "png") {
    return "image/png";
  }

  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }

  throw new Error("Unsupported file type. Please upload a JPG or PNG image.");
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}
