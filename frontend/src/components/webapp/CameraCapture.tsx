"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, RotateCcw, MapPin, Loader2 } from "lucide-react";
import { hapticFeedback } from "@/lib/telegram";

export interface PhotoData {
  questionId: string;
  base64: string;
  timestamp: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
}

interface CameraCaptureProps {
  questionId: string;
  onPhotoCapture: (photo: PhotoData) => void;
  onPhotoRemove?: () => void;
  existingPhoto?: string;
  label?: string;
  required?: boolean;
  className?: string;
}

export function CameraCapture({
  questionId,
  onPhotoCapture,
  onPhotoRemove,
  existingPhoto,
  label = "Tomar Foto",
  required = false,
  className = "",
}: CameraCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(existingPhoto || null);
  const [location, setLocation] = useState<GeolocationCoordinates | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Capturar ubicación al montar
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation(pos.coords);
          setLocationError(null);
        },
        (err) => {
          console.error("Geolocation error:", err);
          setLocationError("No se pudo obtener ubicación");
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    }
  }, []);

  // Agregar marca de agua a la imagen
  const addWatermark = useCallback(
    async (base64: string, date: Date): Promise<string> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(base64);
            return;
          }

          // Dibujar imagen
          ctx.drawImage(img, 0, 0);

          // Barra de marca de agua
          const barHeight = Math.max(30, img.height * 0.05);
          ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
          ctx.fillRect(0, img.height - barHeight, img.width, barHeight);

          // Texto de marca de agua
          const fontSize = Math.max(12, barHeight * 0.5);
          ctx.fillStyle = "#ffffff";
          ctx.font = `${fontSize}px Arial`;

          const dateText = date.toLocaleString("es-MX", {
            dateStyle: "short",
            timeStyle: "medium",
          });

          const watermarkText = `Biorem - ${dateText}`;
          ctx.fillText(watermarkText, 10, img.height - barHeight / 3);

          // Agregar ubicación si está disponible
          if (location) {
            const locationText = `📍 ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
            const textWidth = ctx.measureText(locationText).width;
            ctx.fillText(locationText, img.width - textWidth - 10, img.height - barHeight / 3);
          }

          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = base64;
      });
    },
    [location]
  );

  // Manejar captura de foto
  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    hapticFeedback("light");

    try {
      // Leer archivo como base64
      const reader = new FileReader();

      reader.onload = async () => {
        const base64 = reader.result as string;
        const now = new Date();

        // Agregar marca de agua
        const watermarkedBase64 = await addWatermark(base64, now);

        setPreview(watermarkedBase64);

        // Crear objeto de foto
        const photoData: PhotoData = {
          questionId,
          base64: watermarkedBase64,
          timestamp: now.toISOString(),
        };

        if (location) {
          photoData.location = {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy || undefined,
          };
        }

        onPhotoCapture(photoData);
        hapticFeedback("success");
        setIsProcessing(false);
      };

      reader.onerror = () => {
        console.error("Error reading file");
        setIsProcessing(false);
        hapticFeedback("error");
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error processing photo:", error);
      setIsProcessing(false);
      hapticFeedback("error");
    }
  };

  // Remover foto
  const handleRemove = () => {
    setPreview(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onPhotoRemove?.();
    hapticFeedback("light");
  };

  // Retomar foto
  const handleRetake = () => {
    handleRemove();
    // Pequeño delay para que el input se resetee
    setTimeout(() => {
      inputRef.current?.click();
    }, 100);
  };

  return (
    <div className={`camera-capture ${className}`}>
      {/* Indicador de ubicación */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
        <MapPin className="h-3 w-3" />
        {location ? (
          <span className="text-green-600">
            Ubicación: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          </span>
        ) : locationError ? (
          <span className="text-amber-600">{locationError}</span>
        ) : (
          <span>Obteniendo ubicación...</span>
        )}
      </div>

      {preview ? (
        // Vista previa de la foto
        <div className="relative rounded-lg overflow-hidden border">
          <img
            src={preview}
            alt="Foto capturada"
            className="w-full h-auto max-h-64 object-contain bg-gray-100"
          />

          {/* Botones de acción */}
          <div className="absolute bottom-2 right-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleRetake}
              className="shadow-lg"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Otra
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleRemove}
              className="shadow-lg"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        // Botón para capturar
        <label className="block">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment" // Fuerza cámara trasera
            onChange={handleCapture}
            className="hidden"
            disabled={isProcessing}
          />

          <div
            className={`
              flex flex-col items-center justify-center
              p-6 border-2 border-dashed rounded-lg
              cursor-pointer transition-colors
              ${isProcessing
                ? "border-gray-300 bg-gray-50"
                : "border-primary/50 hover:border-primary hover:bg-primary/5"
              }
            `}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="mt-2 text-sm text-muted-foreground">
                  Procesando...
                </span>
              </>
            ) : (
              <>
                <Camera className="h-8 w-8 text-primary" />
                <span className="mt-2 text-sm font-medium">
                  {label}
                  {required && <span className="text-red-500 ml-1">*</span>}
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  Toca para abrir la cámara
                </span>
              </>
            )}
          </div>
        </label>
      )}
    </div>
  );
}
