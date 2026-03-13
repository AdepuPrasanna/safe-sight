import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SensitiveContentAlertProps {
  onDismiss: () => void;
}

/** Alert shown when sensitive/harmful content is detected */
export default function SensitiveContentAlert({ onDismiss }: SensitiveContentAlertProps) {
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
          <p className="text-foreground">
            Sensitive or harmful images cannot be uploaded on this platform.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Our system detected potentially harmful content including harassment, violence, nudity, or other unsafe material.
          </p>
        </div>
        <Button variant="outline" onClick={onDismiss}>
          Try Another Image
        </Button>
      </CardContent>
    </Card>
  );
}
