"use client";

import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Check, X, Minus, Camera, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SignaturePad } from "@/components/webapp/SignaturePad";
import { CameraCapture, type PhotoData } from "@/components/webapp/CameraCapture";
import {
  getTelegramWebApp,
  getTelegramUser,
  getTelegramUserId,
  setupBackButton,
  hideBackButton,
  setupMainButton,
  hideMainButton,
  showAlert,
  showConfirm,
  hapticFeedback,
} from "@/lib/telegram";

// Tipos
interface Question {
  id: string;
  text: string;
  type: "yes_no" | "yes_no_na";
  required: boolean;
  weight: number;
  requiresPhoto: boolean;
}

interface Area {
  id: string;
  name: string;
  weight: number;
  questions: Question[];
}

interface Answer {
  value: "yes" | "no" | "na" | null;
  photo?: PhotoData;
}

interface EvaluationState {
  currentAreaIndex: number;
  answers: Record<string, Answer>;
  photos: PhotoData[];
  signature: string | null;
  signerName: string;
  startedAt: Date;
}

// Plantilla por defecto (mientras no carguemos del API)
const DEFAULT_TEMPLATE: { areas: Area[]; passingScore: number } = {
  passingScore: 70,
  areas: [
    {
      id: "drenajes",
      name: "Estado de Drenajes",
      weight: 0.35,
      questions: [
        {
          id: "drenajes_1",
          text: "¿Los drenajes están libres de obstrucciones?",
          type: "yes_no",
          required: true,
          weight: 0.33,
          requiresPhoto: true,
        },
        {
          id: "drenajes_2",
          text: "¿Se aplicó el producto en todos los drenajes?",
          type: "yes_no",
          required: true,
          weight: 0.33,
          requiresPhoto: true,
        },
        {
          id: "drenajes_3",
          text: "¿El área está libre de malos olores?",
          type: "yes_no",
          required: true,
          weight: 0.34,
          requiresPhoto: false,
        },
      ],
    },
    {
      id: "producto",
      name: "Manejo del Producto",
      weight: 0.30,
      questions: [
        {
          id: "producto_1",
          text: "¿El producto está almacenado correctamente?",
          type: "yes_no",
          required: true,
          weight: 0.50,
          requiresPhoto: true,
        },
        {
          id: "producto_2",
          text: "¿Hay suficiente inventario de producto?",
          type: "yes_no",
          required: true,
          weight: 0.50,
          requiresPhoto: false,
        },
      ],
    },
    {
      id: "seguridad",
      name: "Seguridad y Procedimientos",
      weight: 0.35,
      questions: [
        {
          id: "seguridad_1",
          text: "¿El personal usa equipo de protección?",
          type: "yes_no_na",
          required: true,
          weight: 0.33,
          requiresPhoto: true,
        },
        {
          id: "seguridad_2",
          text: "¿Se sigue el procedimiento de aplicación?",
          type: "yes_no",
          required: true,
          weight: 0.33,
          requiresPhoto: false,
        },
        {
          id: "seguridad_3",
          text: "¿Se registra la aplicación en bitácora?",
          type: "yes_no_na",
          required: true,
          weight: 0.34,
          requiresPhoto: false,
        },
      ],
    },
  ],
};

type Step = "questions" | "signature" | "submitting" | "complete";

export default function EvaluacionPage() {
  const [step, setStep] = useState<Step>("questions");
  const [state, setState] = useState<EvaluationState>({
    currentAreaIndex: 0,
    answers: {},
    photos: [],
    signature: null,
    signerName: "",
    startedAt: new Date(),
  });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    id: number;
  } | null>(null);

  const template = DEFAULT_TEMPLATE;
  const currentArea = template.areas[state.currentAreaIndex];
  const isLastArea = state.currentAreaIndex === template.areas.length - 1;

  // Inicializar Telegram
  useEffect(() => {
    const tg = getTelegramWebApp();
    if (tg) {
      tg.ready();
      tg.expand();

      setupBackButton(() => {
        if (step === "signature") {
          setStep("questions");
        } else if (state.currentAreaIndex > 0) {
          setState((s) => ({ ...s, currentAreaIndex: s.currentAreaIndex - 1 }));
        } else {
          window.history.back();
        }
      });

      // Prellenar nombre del usuario
      const user = getTelegramUser();
      if (user) {
        const fullName = `${user.first_name}${user.last_name ? ` ${user.last_name}` : ""}`;
        setState((s) => ({ ...s, signerName: fullName }));
      }
    }

    return () => {
      hideBackButton();
      hideMainButton();
    };
  }, [step, state.currentAreaIndex]);

  // Manejar respuesta a pregunta
  const handleAnswer = useCallback(
    (questionId: string, value: "yes" | "no" | "na") => {
      hapticFeedback("light");
      setState((s) => ({
        ...s,
        answers: {
          ...s.answers,
          [questionId]: {
            ...s.answers[questionId],
            value,
          },
        },
      }));
    },
    []
  );

  // Manejar foto capturada
  const handlePhotoCapture = useCallback((photo: PhotoData) => {
    hapticFeedback("success");
    setState((s) => ({
      ...s,
      answers: {
        ...s.answers,
        [photo.questionId]: {
          ...s.answers[photo.questionId],
          photo,
        },
      },
      photos: [...s.photos.filter((p) => p.questionId !== photo.questionId), photo],
    }));
  }, []);

  // Verificar si el área actual está completa
  const isAreaComplete = useCallback(() => {
    if (!currentArea) return false;

    for (const question of currentArea.questions) {
      const answer = state.answers[question.id];
      if (!answer?.value) return false;
      if (question.requiresPhoto && answer.value !== "na" && !answer.photo) {
        return false;
      }
    }
    return true;
  }, [currentArea, state.answers]);

  // Avanzar a siguiente área o firma
  const handleNext = useCallback(() => {
    if (!isAreaComplete()) {
      showAlert("Por favor completa todas las preguntas y fotos requeridas");
      return;
    }

    hapticFeedback("medium");

    if (isLastArea) {
      setStep("signature");
    } else {
      setState((s) => ({ ...s, currentAreaIndex: s.currentAreaIndex + 1 }));
    }
  }, [isAreaComplete, isLastArea]);

  // Enviar evaluación
  const handleSubmit = useCallback(async () => {
    if (!state.signature) {
      showAlert("Por favor firma la evaluación");
      return;
    }

    if (!state.signerName.trim() || state.signerName.trim().length < 2) {
      showAlert("Por favor ingresa tu nombre completo");
      return;
    }

    const confirmed = await showConfirm(
      `¿Confirmas enviar la evaluación firmada por "${state.signerName}"?`
    );

    if (!confirmed) return;

    setStep("submitting");
    hapticFeedback("medium");

    try {
      const telegramId = getTelegramUserId();

      // Preparar datos
      const answersForApi: Record<string, { value: string; photo_url?: string }> = {};
      for (const [qId, answer] of Object.entries(state.answers)) {
        answersForApi[qId] = {
          value: answer.value || "no",
          photo_url: answer.photo?.base64,
        };
      }

      // Obtener ubicación actual para la firma
      let signatureLocation: { latitude: number; longitude: number } | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          });
        });
        signatureLocation = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
      } catch {
        // Continuar sin ubicación
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://resilient-strength-production-6673.up.railway.app";

      const response = await fetch(`${API_URL}/api/evaluations/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_id: 1, // TODO: Obtener del contexto del usuario
          telegram_user_id: String(telegramId),
          answers: answersForApi,
          photos: state.photos.map((p) => ({
            question_id: p.questionId,
            url: p.base64,
            timestamp: p.timestamp,
            latitude: p.location?.latitude,
            longitude: p.location?.longitude,
          })),
          signature_data: state.signature,
          signed_by_name: state.signerName.trim(),
          signature_latitude: signatureLocation?.latitude,
          signature_longitude: signatureLocation?.longitude,
          started_at: state.startedAt.toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Error al enviar evaluación");
      }

      const data = await response.json();

      setResult({
        score: data.total_score,
        passed: data.passed,
        id: data.id,
      });

      setStep("complete");
      hapticFeedback(data.passed ? "success" : "warning");
    } catch (err) {
      console.error("Error submitting evaluation:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
      setStep("signature");
      hapticFeedback("error");
    }
  }, [state]);

  // Cerrar y volver
  const handleClose = useCallback(() => {
    const tg = getTelegramWebApp();
    if (tg) {
      tg.close();
    } else {
      window.history.back();
    }
  }, []);

  // ==================== RENDER ====================

  // Pantalla de carga/enviando
  if (step === "submitting") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg font-medium">Enviando evaluación...</p>
        <p className="text-sm text-muted-foreground mt-2">
          Por favor espera, esto puede tomar unos segundos.
        </p>
      </div>
    );
  }

  // Pantalla de resultado
  if (step === "complete" && result) {
    return (
      <div className="flex flex-col min-h-screen p-4">
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${
              result.passed
                ? "bg-green-100 dark:bg-green-900/30"
                : "bg-red-100 dark:bg-red-900/30"
            }`}
          >
            {result.passed ? (
              <Check className="h-12 w-12 text-green-600" />
            ) : (
              <X className="h-12 w-12 text-red-600" />
            )}
          </div>

          <h1 className="text-2xl font-bold mb-2">
            {result.passed ? "¡Evaluación Aprobada!" : "Evaluación No Aprobada"}
          </h1>

          <p className="text-4xl font-bold text-primary mb-4">
            {result.score.toFixed(0)}%
          </p>

          <p className="text-muted-foreground mb-6">
            {result.passed
              ? "Excelente trabajo. La evaluación ha sido registrada."
              : "No se alcanzó el puntaje mínimo de 70%. Se notificará al supervisor."}
          </p>

          <div className="bg-card border rounded-lg p-4 w-full max-w-sm mb-6">
            <p className="text-sm text-muted-foreground">
              Evaluación #{result.id}
            </p>
            <p className="text-sm">
              Firmada por: <strong>{state.signerName}</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleString("es-MX")}
            </p>
          </div>

          <Button onClick={handleClose} size="lg" className="w-full max-w-sm">
            Cerrar
          </Button>
        </div>
      </div>
    );
  }

  // Pantalla de firma
  if (step === "signature") {
    return (
      <div className="flex flex-col min-h-screen p-4">
        <header className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setStep("questions")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Firma y Confirmación</h1>
            <p className="text-sm text-muted-foreground">
              Paso final de la evaluación
            </p>
          </div>
        </header>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex-1 space-y-6">
          {/* Nombre del firmante */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Nombre completo del evaluador *
            </label>
            <Input
              type="text"
              placeholder="Escribe tu nombre completo"
              value={state.signerName}
              onChange={(e) =>
                setState((s) => ({ ...s, signerName: e.target.value }))
              }
              className="text-lg"
              maxLength={100}
            />
          </div>

          {/* Firma digital */}
          <div>
            <SignaturePad
              signerName={state.signerName || "Evaluador"}
              onSignatureChange={(sig) =>
                setState((s) => ({ ...s, signature: sig }))
              }
            />
          </div>

          {/* Resumen */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-medium mb-2">Resumen de la evaluación</h3>
            <ul className="text-sm space-y-1">
              {template.areas.map((area) => {
                const answered = area.questions.filter(
                  (q) => state.answers[q.id]?.value
                ).length;
                return (
                  <li key={area.id} className="flex justify-between">
                    <span>{area.name}</span>
                    <span className="text-muted-foreground">
                      {answered}/{area.questions.length} preguntas
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-sm mt-2">
              Fotos adjuntas: <strong>{state.photos.length}</strong>
            </p>
          </div>
        </div>

        <div className="pt-4">
          <Button
            onClick={handleSubmit}
            size="lg"
            className="w-full"
            disabled={!state.signature || !state.signerName.trim()}
          >
            Enviar Evaluación
          </Button>
        </div>
      </div>
    );
  }

  // Pantalla de preguntas
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 bg-background border-b p-4 z-10">
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (state.currentAreaIndex > 0) {
                setState((s) => ({ ...s, currentAreaIndex: s.currentAreaIndex - 1 }));
              } else {
                window.history.back();
              }
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{currentArea.name}</h1>
            <p className="text-xs text-muted-foreground">
              Área {state.currentAreaIndex + 1} de {template.areas.length}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{
              width: `${((state.currentAreaIndex + 1) / template.areas.length) * 100}%`,
            }}
          />
        </div>
      </header>

      {/* Questions */}
      <div className="flex-1 p-4 space-y-6">
        {currentArea.questions.map((question, qIndex) => {
          const answer = state.answers[question.id];

          return (
            <div key={question.id} className="bg-card border rounded-xl p-4">
              <p className="font-medium mb-3">
                {qIndex + 1}. {question.text}
                {question.required && <span className="text-red-500 ml-1">*</span>}
              </p>

              {/* Botones de respuesta */}
              <div className="flex gap-2 mb-3">
                <Button
                  type="button"
                  variant={answer?.value === "yes" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleAnswer(question.id, "yes")}
                  className="flex-1"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Sí
                </Button>
                <Button
                  type="button"
                  variant={answer?.value === "no" ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => handleAnswer(question.id, "no")}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-1" />
                  No
                </Button>
                {question.type === "yes_no_na" && (
                  <Button
                    type="button"
                    variant={answer?.value === "na" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => handleAnswer(question.id, "na")}
                    className="flex-1"
                  >
                    <Minus className="h-4 w-4 mr-1" />
                    N/A
                  </Button>
                )}
              </div>

              {/* Foto requerida */}
              {question.requiresPhoto && answer?.value && answer.value !== "na" && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Camera className="h-4 w-4" />
                    <span>Foto requerida</span>
                  </div>
                  <CameraCapture
                    questionId={question.id}
                    onPhotoCapture={handlePhotoCapture}
                    existingPhoto={answer.photo?.base64}
                    required
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-background border-t p-4">
        <Button
          onClick={handleNext}
          size="lg"
          className="w-full"
          disabled={!isAreaComplete()}
        >
          {isLastArea ? "Continuar a Firma" : "Siguiente Área"}
        </Button>
      </div>
    </div>
  );
}
