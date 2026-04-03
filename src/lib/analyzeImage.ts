import { supabase } from "@/integrations/supabase/client";
import type { AnalysisResult } from "@/components/ResultsDashboard";

/**
 * Sends an image to the analyze-image edge function.
 * Converts to clean base64 without corruption.
 */
export async function analyzeImage(file: File): Promise<AnalysisResult> {
  const base64 = await fileToBase64(file);
  const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";

  const { data, error } = await supabase.functions.invoke("analyze-image", {
    body: { image: base64, mimeType },
  });

  if (error) {
    throw new Error(error.message || "Failed to analyze image");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as AnalysisResult;
}

function cleanBase64(base64String: string): string {
  if (!base64String) throw new Error("Empty base64 string");
  let cleaned = base64String.trim();
  // Strip data URI prefix if present
  if (cleaned.includes(",") && cleaned.startsWith("data:")) {
    cleaned = cleaned.split(",")[1];
  }
  // Remove any whitespace
  cleaned = cleaned.replace(/\s/g, "");
  // Validate base64 format
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
    throw new Error("Invalid base64 string after cleaning");
  }
  return cleaned;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = reader.result as string;
        const base64 = cleanBase64(result);
        resolve(base64);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
