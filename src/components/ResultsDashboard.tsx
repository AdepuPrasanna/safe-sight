import { Shield, ShieldAlert, Brain, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export interface AnalysisResult {
  /** Whether the image is classified as AI-generated */
  isAiGenerated: boolean;
  /** Confidence score 0-100 */
  aiConfidence: number;
  /** AI reasoning explanation */
  reasoning?: string;
  /** Whether upload is allowed */
  uploadAllowed: boolean;
  /** Message from backend */
  message?: string;
  /** Whether sensitive content was detected */
  isSensitive: boolean;
  /** Individual sensitive content categories */
  sensitiveCategories: {
    adult: string;
    violence: string;
    racy: string;
    medical: string;
  };
  /** Labels detected in the image */
  labels: string[];
  /** Whether keyword matching triggered */
  keywordMatch?: boolean;
}

interface ResultsDashboardProps {
  result: AnalysisResult;
}

/** Maps Vision API likelihood strings to severity levels */
function likelihoodToLevel(likelihood: string): "safe" | "low" | "medium" | "high" {
  switch (likelihood) {
    case "VERY_LIKELY":
    case "LIKELY": return "high";
    case "POSSIBLE": return "medium";
    case "UNLIKELY": return "low";
    default: return "safe";
  }
}

function LikelihoodBadge({ label, value }: { label: string; value: string }) {
  const level = likelihoodToLevel(value);
  const colors = {
    safe: "bg-success/10 text-success border-success/20",
    low: "bg-success/10 text-success border-success/20",
    medium: "bg-warning/10 text-warning border-warning/20",
    high: "bg-destructive/10 text-destructive border-destructive/20",
  };
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${colors[level]}`}>
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs uppercase font-heading tracking-wider">{value.replace("_", " ")}</span>
    </div>
  );
}

export default function ResultsDashboard({ result }: ResultsDashboardProps) {
  return (
    <div className="space-y-4">
      {/* AI Detection Result */}
      <Card className={result.isAiGenerated ? "border-warning/40 glow-accent" : "border-success/40 glow-primary"}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="w-5 h-5 text-accent" />
            Deepfake Detection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            {result.isAiGenerated ? (
              <AlertTriangle className="w-6 h-6 text-warning" />
            ) : (
              <CheckCircle2 className="w-6 h-6 text-success" />
            )}
            <span className="text-lg font-heading font-semibold">
              {result.isAiGenerated ? "AI Generated Image" : "Real Human Image"}
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Confidence</span>
              <span className="font-heading font-semibold">{result.aiConfidence}%</span>
            </div>
            <Progress value={result.aiConfidence} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Sensitive Content Result */}
      <Card className={result.isSensitive ? "border-destructive/40 glow-danger" : "border-success/40 glow-primary"}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            {result.isSensitive ? (
              <ShieldAlert className="w-5 h-5 text-destructive" />
            ) : (
              <Shield className="w-5 h-5 text-success" />
            )}
            Content Safety
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <LikelihoodBadge label="Adult Content" value={result.sensitiveCategories.adult} />
          <LikelihoodBadge label="Violence" value={result.sensitiveCategories.violence} />
          <LikelihoodBadge label="Racy Content" value={result.sensitiveCategories.racy} />
          <LikelihoodBadge label="Medical" value={result.sensitiveCategories.medical} />
        </CardContent>
      </Card>

      {/* Labels */}
      {result.labels.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Detected Labels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {result.labels.map((label) => (
                <span key={label} className="px-2.5 py-1 text-xs font-heading rounded-full bg-secondary text-secondary-foreground border border-border">
                  {label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
