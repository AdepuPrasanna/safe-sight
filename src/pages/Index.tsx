import { useState } from "react";
import { ScanEye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ImageUploader from "@/components/ImageUploader";
import ResultsDashboard, { type AnalysisResult } from "@/components/ResultsDashboard";
import SensitiveContentAlert from "@/components/SensitiveContentAlert";
import { analyzeImage } from "@/lib/analyzeImage";
import { toast } from "sonner";

export default function Index() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [blockMessage, setBlockMessage] = useState("");

  const revokePreviewUrl = (url: string | null) => {
    if (url?.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  };

  const handleImageSelect = (selectedFile: File, previewUrl: string) => {
    revokePreviewUrl(preview);
    setFile(selectedFile);
    setPreview(previewUrl);
    setResult(null);
    setBlocked(false);
    setBlockMessage("");
  };

  const handleClear = () => {
    revokePreviewUrl(preview);
    setFile(null);
    setPreview(null);
    setResult(null);
    setBlocked(false);
    setBlockMessage("");
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setResult(null);
    setBlocked(false);

    try {
      const analysisResult = await analyzeImage(file);
      setResult(analysisResult);

      if (!analysisResult.uploadAllowed) {
        setBlocked(true);
        setBlockMessage(analysisResult.message);
        if (analysisResult.isSensitive) {
          setPreview(null);
          setFile(null);
        }
      } else {
        setBlocked(false);
        setBlockMessage("");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background bg-grid-pattern">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <ScanEye className="w-4 h-4 text-primary" />
            <span className="text-xs font-heading text-primary uppercase tracking-widest">
              AI Detection System
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-gradient-primary mb-3">
            Deep Fake & Sensitive Image Detection
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Upload an image to detect AI-generated content and check for sensitive or harmful material.
          </p>
        </header>

        <div className="space-y-4">
          <ImageUploader
            onImageSelect={handleImageSelect}
            preview={preview}
            onClear={handleClear}
            isAnalyzing={isAnalyzing}
          />

          {file && !result && !blocked && (
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="w-full h-12 font-heading text-sm uppercase tracking-wider animate-pulse-glow"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing Image…
                </>
              ) : (
                <>
                  <ScanEye className="w-4 h-4" />
                  Analyze Image
                </>
              )}
            </Button>
          )}

          {blocked && (
            <SensitiveContentAlert
              onDismiss={handleClear}
              message={blockMessage}
            />
          )}

          {result && <ResultsDashboard result={result} />}
        </div>
      </div>
    </div>
  );
}
