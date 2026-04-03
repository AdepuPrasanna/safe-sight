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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix to get raw base64
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("Failed to convert image to base64"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
