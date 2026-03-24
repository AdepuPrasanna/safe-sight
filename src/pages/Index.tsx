import { useState } from "react";
import { ScanEye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ImageUploader from "@/components/ImageUploader";
import ResultsDashboard, { type AnalysisResult } from "@/components/ResultsDashboard";
import SensitiveContentAlert from "@/components/SensitiveContentAlert";
import AiBlockedAlert from "@/components/AiBlockedAlert";
import { analyzeImage } from "@/lib/analyzeImage";
import { toast } from "sonner";

/**
 * Main page: Deep Fake & Sensitive Image Detection System
 */
export default function Index() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [aiBlocked, setAiBlocked] = useState<{ message?: string; reasoning?: string } | null>(null);

  const handleImageSelect = (selectedFile: File, previewUrl: string) => {
    setFile(selectedFile);
    setPreview(previewUrl);
    setResult(null);
    setBlocked(false);
    setAiBlocked(null);
  };

  const handleClear = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setBlocked(false);
    setAiBlocked(null);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setResult(null);
    setBlocked(false);
    setAiBlocked(null);

    try {
      const analysisResult = await analyzeImage(file);

      if (!analysisResult.uploadAllowed) {
        if (analysisResult.isAiGenerated) {
          setAiBlocked({
            message: analysisResult.message,
            reasoning: analysisResult.reasoning,
          });
        } else {
          setBlocked(true);
        }
        setPreview(null);
        setFile(null);
      } else {
        setResult(analysisResult);
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
        {/* Header */}
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
            Upload an image to detect AI-generated content and check for sensitive or harmful material using Google Cloud Vision.
          </p>
        </header>

        {/* Upload Section */}
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

          {/* AI Blocked Alert */}
          {aiBlocked && (
            <AiBlockedAlert
              message={aiBlocked.message}
              reasoning={aiBlocked.reasoning}
              onDismiss={handleClear}
            />
          )}

          {/* Sensitive Content Blocked Alert */}
          {blocked && <SensitiveContentAlert onDismiss={handleClear} />}

          {/* Results */}
          {result && <ResultsDashboard result={result} />}
        </div>
      </div>
    </div>
  );
}
