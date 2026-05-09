"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  fieldName?: string; // hidden input name; default "signature"
  width?: number;
  height?: number;
  defaultDataUrl?: string;
  required?: boolean;
};

export function SignaturePad({
  fieldName = "signature",
  width = 480,
  height = 160,
  defaultDataUrl,
  required,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasDrawn, setHasDrawn] = useState(!!defaultDataUrl);
  const [dataUrl, setDataUrl] = useState<string>(defaultDataUrl ?? "");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // High-DPI scaling
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);

    if (defaultDataUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, width, height);
      img.src = defaultDataUrl;
    }

    let drawing = false;
    let last: { x: number; y: number } | null = null;

    const point = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      drawing = true;
      last = point(e);
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drawing || !last) return;
      const p = point(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      setHasDrawn(true);
    };
    const up = () => {
      drawing = false;
      last = null;
      setDataUrl(canvas.toDataURL("image/png"));
    };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("pointerleave", up);

    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("pointerleave", up);
    };
  }, [width, height, defaultDataUrl]);

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setDataUrl("");
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className="touch-none rounded-md border border-[hsl(var(--border))] bg-white"
      />
      <input type="hidden" name={fieldName} value={dataUrl} required={required} />
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={clear}>
          Clear
        </Button>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {hasDrawn ? "Signature captured" : "Sign above"}
        </span>
      </div>
    </div>
  );
}
