import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AiBlockedAlertProps {
  message?: string;
  reasoning?: string;
  onDismiss: () => void;
}

/** Alert shown when AI-generated content is detected and upload is blocked */
export default function AiBlockedAlert({ message, reasoning, onDismiss }: AiBlockedAlertProps) {
  return (
    <Card className="border-destructive/50 glow-danger bg-destructive/5">
      <CardContent className="p-6 flex flex-col items-center text-center gap-4">
        <div className="p-3 rounded-full bg-destructive/10">
          <ShieldAlert className="w-10 h-10 text-destructive" />
        </div>
        <div>
          <h3 className="text-lg font-heading font-bold text-destructive mb-1">
            Upload Blocked
          </h3>
          <p className="text-destructive font-semibold">
            {message || "Upload failed: AI-generated images are not allowed."}
          </p>
          {reasoning && (
            <p className="text-sm text-muted-foreground mt-2">
              <strong>Reason:</strong> {reasoning}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-2">
            Our system has determined this image was created by an AI tool (e.g. ChatGPT, DALL-E, Midjourney, Stable Diffusion). Only real photographs are allowed.
          </p>
        </div>
        <Button variant="outline" onClick={onDismiss}>
          Try Another Image
        </Button>
      </CardContent>
    </Card>
  );
}
