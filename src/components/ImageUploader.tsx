import { useCallback, useState } from "react";
import { Upload, X, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Max file size: 10MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png"];

interface ImageUploaderProps {
  onImageSelect: (file: File, preview: string) => void;
  preview: string | null;
  onClear: () => void;
  isAnalyzing: boolean;
}

export default function ImageUploader({ onImageSelect, preview, onClear, isAnalyzing }: ImageUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAndSelect = useCallback((file: File) => {
    setError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Invalid file type. Only JPG, JPEG, and PNG are supported.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File too large. Maximum size is 10MB.");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    onImageSelect(file, previewUrl);
  }, [onImageSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSelect(file);
  }, [validateAndSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSelect(file);
  }, [validateAndSelect]);

  if (preview) {
    return (
      <Card className="relative overflow-hidden border-primary/30 glow-primary">
        <CardContent className="p-4">
          <div className="relative">
            <img
              src={preview}
              alt="Uploaded preview"
              className="mx-auto block w-full h-auto max-h-80 rounded-lg object-contain"
            />
            {isAnalyzing && (
              <div className="absolute inset-0 bg-background/60 flex items-center justify-center rounded-lg">
                <div className="h-1 w-3/4 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary animate-scan rounded-full" style={{ width: "40%" }} />
                </div>
              </div>
            )}
            {!isAnalyzing && (
              <button
                onClick={onClear}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-secondary hover:bg-destructive transition-colors"
              >
                <X className="w-4 h-4 text-foreground" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "border-dashed border-2 transition-all duration-200",
      dragActive ? "border-primary glow-primary bg-primary/5" : "border-border hover:border-primary/50"
    )}>
      <CardContent className="p-10">
        <label
          className="flex flex-col items-center gap-4 cursor-pointer"
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <div className="p-4 rounded-full bg-secondary">
            {dragActive ? (
              <FileImage className="w-10 h-10 text-primary" />
            ) : (
              <Upload className="w-10 h-10 text-muted-foreground" />
            )}
          </div>
          <div className="text-center">
            <p className="text-foreground font-medium">
              {dragActive ? "Drop your image here" : "Drag & drop or click to upload"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Supports JPG, JPEG, PNG • Max 10MB
            </p>
          </div>
          <Button variant="outline" size="sm" type="button" disabled={isAnalyzing} asChild>
            <span>Browse Files</span>
          </Button>
          <input
            type="file"
            accept=".jpg,.jpeg,.png"
            className="hidden"
            onChange={handleFileInput}
          />
          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}
        </label>
      </CardContent>
    </Card>
  );
}
