import { supabase } from "@/integrations/supabase/client";
import type { AnalysisResult } from "@/components/ResultsDashboard";

/**
 * Sends an image to the analyze-image edge function for processing
 * via Google Cloud Vision API.
 */
export async function analyzeImage(file: File): Promise<AnalysisResult> {
  // Convert file to base64
  const base64 = await fileToBase64(file);

  const { data, error } = await supabase.functions.invoke("analyze-image", {
    body: { image: base64 },
  });

  if (error) {
    throw new Error(error.message || "Failed to analyze image");
  }

  return data as AnalysisResult;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Strip the data URL prefix to get raw base64
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
