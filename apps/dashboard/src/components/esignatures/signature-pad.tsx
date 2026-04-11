"use client";

import { forwardRef, useRef, useEffect, useState, type MouseEvent, type TouchEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DownloadIcon,
  UndoIcon,
  RedoIcon,
  Trash2Icon,
  UploadIcon,
  CheckIcon,
} from "lucide-react";

interface SignaturePadProps {
  onSave?: (data: { png: string; svg: string }) => void;
  onAdopt?: (signature: string) => void;
  className?: string;
}

function getEventCoords(e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>): { clientX: number; clientY: number } {
  if ('touches' in e) {
    return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
  }
  return { clientX: e.clientX, clientY: e.clientY };
}

const SignaturePad = forwardRef<HTMLCanvasElement, SignaturePadProps>(
  ({ onSave, onAdopt, className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [history, setHistory] = useState<ImageData[]>([]);
    const [historyStep, setHistoryStep] = useState(-1);
    const [hasSignature, setHasSignature] = useState(false);
    const [typeMode, setTypeMode] = useState(false);
    const [typedText, setTypedText] = useState("");

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = 500;
      canvas.height = 200;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#1f2937";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Save initial state
      setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)]);
      setHistoryStep(0);
    }, []);

    const saveHistory = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const newHistory = history.slice(0, historyStep + 1);
      newHistory.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      setHistory(newHistory);
      setHistoryStep(newHistory.length - 1);
    };

    const startDrawing = (
      e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>
    ) => {
      if (!hasSignature) setHasSignature(true);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const coords = getEventCoords(e);
      const x = coords.clientX - rect.left;
      const y = coords.clientY - rect.top;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
    };

    const draw = (
      e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>
    ) => {
      if (!isDrawing) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const coords = getEventCoords(e);
      const x = coords.clientX - rect.left;
      const y = coords.clientY - rect.top;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const stopDrawing = () => {
      setIsDrawing(false);
      saveHistory();
    };

    const undo = () => {
      if (historyStep > 0) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const newStep = historyStep - 1;
        ctx.putImageData(history[newStep], 0, 0);
        setHistoryStep(newStep);
        setHasSignature(newStep > 0);
      }
    };

    const redo = () => {
      if (historyStep < history.length - 1) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const newStep = historyStep + 1;
        ctx.putImageData(history[newStep], 0, 0);
        setHistoryStep(newStep);
        setHasSignature(true);
      }
    };

    const clear = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)]);
      setHistoryStep(0);
      setHasSignature(false);
      setTypedText("");
      setTypeMode(false);
    };

    const addTypeSignature = () => {
      const canvas = canvasRef.current;
      if (!canvas || !typedText) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.font = "italic 48px cursive";
      ctx.fillStyle = "#1f2937";
      ctx.fillText(typedText, 50, 120);
      setHasSignature(true);
      saveHistory();
      setTypeMode(false);
    };

    const uploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const scale = Math.min(
            canvas.width / img.width,
            canvas.height / img.height
          );
          const x = (canvas.width - img.width * scale) / 2;
          const y = (canvas.height - img.height * scale) / 2;
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

          setHasSignature(true);
          saveHistory();
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    };

    const saveToPNG = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const link = document.createElement("a");
      link.download = "signature.png";
      link.href = canvas.toDataURL("image/png");
      link.click();

      if (onSave) {
        onSave({
          png: canvas.toDataURL("image/png"),
          svg: canvas.toDataURL("image/svg+xml"),
        });
      }
    };

    const handleAdoptSignature = () => {
      const canvas = canvasRef.current;
      if (!canvas || !hasSignature) return;
      if (onAdopt) {
        onAdopt(canvas.toDataURL("image/png"));
      }
    };

    return (
      <div className={cn("w-full space-y-4", className)}>
        <div className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-4">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full border border-wl-border-default rounded cursor-crosshair bg-white"
            style={{ maxHeight: "200px" }}
          />

          <div className="mt-3 flex items-center gap-2 text-xs text-wl-text-secondary">
            <div className="flex-1 h-px bg-wl-border-default" />
            <span>Draw your signature above</span>
            <div className="flex-1 h-px bg-wl-border-default" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={undo}
            disabled={historyStep <= 0}
            className="gap-1"
          >
            <UndoIcon className="w-4 h-4" />
            Undo
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={redo}
            disabled={historyStep >= history.length - 1}
            className="gap-1"
          >
            <RedoIcon className="w-4 h-4" />
            Redo
          </Button>

          <div className="flex-1" />

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setTypeMode(!typeMode)}
            className="gap-1"
          >
            <span className="italic">A</span>
            Type to Sign
          </Button>

          <label>
            <input
              type="file"
              accept="image/*"
              onChange={uploadImage}
              className="hidden"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.preventDefault();
                (e.currentTarget.parentElement?.querySelector(
                  "input[type=file]"
                ) as HTMLInputElement)?.click();
              }}
              className="gap-1"
            >
              <UploadIcon className="w-4 h-4" />
              Upload
            </Button>
          </label>

          <Button
            size="sm"
            variant="danger"
            onClick={clear}
            disabled={!hasSignature}
            className="gap-1"
          >
            <Trash2Icon className="w-4 h-4" />
            Clear
          </Button>
        </div>

        {typeMode && (
          <div className="space-y-2 p-3 bg-wl-bg-overlay rounded-lg border border-wl-border-default">
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-3 py-2 rounded text-sm bg-wl-bg-surface border border-wl-border-default text-wl-text-primary"
              onKeyPress={(e) => e.key === "Enter" && addTypeSignature()}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setTypeMode(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={addTypeSignature}
                disabled={!typedText}
              >
                Add Signature
              </Button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={saveToPNG}
            disabled={!hasSignature}
            className="gap-1 flex-1"
          >
            <DownloadIcon className="w-4 h-4" />
            Save as PNG
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={handleAdoptSignature}
            disabled={!hasSignature}
            className="gap-1 flex-1"
          >
            <CheckIcon className="w-4 h-4" />
            Adopt & Sign
          </Button>
        </div>
      </div>
    );
  }
);

SignaturePad.displayName = "SignaturePad";

export { SignaturePad };
