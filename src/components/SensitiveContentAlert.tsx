import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SensitiveContentAlertProps {
  onDismiss: () => void;
  message?: string;
}

export default function SensitiveContentAlert({ onDismiss, message }: SensitiveContentAlertProps) {
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
            {message || "Sensitive or harmful images cannot be uploaded on this platform."}
          </p>
        </div>
        <Button variant="outline" onClick={onDismiss}>
          Try Another Image
        </Button>
      </CardContent>
    </Card>
  );
}
