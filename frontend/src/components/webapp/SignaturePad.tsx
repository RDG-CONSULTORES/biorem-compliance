"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

interface SignaturePadProps {
  onSignatureChange: (signature: string | null) => void;
  signerName: string;
  width?: number;
  height?: number;
  className?: string;
}

export function SignaturePad({
  onSignatureChange,
  signerName,
  width = 350,
  height = 150,
  className = "",
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  // Inicializar canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    // Configurar el canvas para alta resolución
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.scale(dpr, dpr);

    // Configurar estilo del trazo
    context.strokeStyle = "#000000";
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";

    // Fondo blanco
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);

    setCtx(context);
  }, [width, height]);

  // Obtener posición del toque/mouse
  const getPosition = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      let clientX: number, clientY: number;

      if ("touches" in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    []
  );

  // Iniciar dibujo
  const startDrawing = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!ctx) return;

      const { x, y } = getPosition(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
    },
    [ctx, getPosition]
  );

  // Dibujar
  const draw = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!isDrawing || !ctx) return;

      e.preventDefault();
      const { x, y } = getPosition(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      setIsEmpty(false);
    },
    [isDrawing, ctx, getPosition]
  );

  // Terminar dibujo
  const stopDrawing = useCallback(() => {
    if (!ctx) return;

    ctx.closePath();
    setIsDrawing(false);

    // Notificar el cambio
    const canvas = canvasRef.current;
    if (canvas && !isEmpty) {
      const dataUrl = canvas.toDataURL("image/png");
      onSignatureChange(dataUrl);
    }
  }, [ctx, isEmpty, onSignatureChange]);

  // Limpiar firma
  const clearSignature = useCallback(() => {
    if (!ctx || !canvasRef.current) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    setIsEmpty(true);
    onSignatureChange(null);
  }, [ctx, width, height, onSignatureChange]);

  return (
    <div className={`signature-container ${className}`}>
      <div className="mb-2">
        <p className="text-sm font-medium">
          Firma de: <span className="font-semibold">{signerName}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Al firmar, confirmo que la información proporcionada es verídica.
        </p>
      </div>

      <div className="relative border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 text-sm">Dibuja tu firma aquí</p>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearSignature}
          disabled={isEmpty}
          className="flex items-center gap-1"
        >
          <Eraser className="h-4 w-4" />
          Limpiar
        </Button>

        <p className="text-xs text-muted-foreground">
          {new Date().toLocaleString("es-MX", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </p>
      </div>
    </div>
  );
}
