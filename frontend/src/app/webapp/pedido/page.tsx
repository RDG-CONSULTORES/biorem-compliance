"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft,
  Package,
  MapPin,
  Minus,
  Plus,
  ShoppingCart,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignaturePad } from "@/components/webapp/SignaturePad";
import {
  getTelegramWebApp,
  getTelegramUserId,
  setupBackButton,
  hideBackButton,
  showMainButton,
  hideMainButton,
  hapticFeedback,
} from "@/lib/telegram";

// Ensure HTTPS is always used (env var might have http://)
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "https://resilient-strength-production-6673.up.railway.app";
const API_URL = rawApiUrl.replace(/^http:\/\//i, "https://");

// ==================== TYPES ====================

interface Location {
  id: number;
  name: string;
  address?: string;
}

interface Product {
  id: number;
  name: string;
  description?: string;
  sku?: string;
  dosage?: string;
  category?: string;
  active: boolean;
}

interface UserContext {
  contact_id: number;
  name: string;
  role: string;
  client_id: number;
  client_name: string;
  locations: Location[];
}

interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
}

type Step = "loading" | "error" | "location" | "products" | "summary" | "signature" | "success";

// ==================== COMPONENT ====================

export default function PedidoPage() {
  // Telegram WebApp
  const [telegramId, setTelegramId] = useState<string | null>(null);

  // User context
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  // Flow state
  const [step, setStep] = useState<Step>("loading");
  const [error, setError] = useState<string | null>(null);

  // Order state
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [cart, setCart] = useState<Map<number, CartItem>>(new Map());
  const [orderNotes, setOrderNotes] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Submitting
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ==================== INIT ====================

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 30; // 3 seconds max wait

    const initTelegram = () => {
      // Debug: Check what's available
      const hasTelegram = typeof window !== "undefined" && !!window.Telegram;
      const hasWebApp = hasTelegram && !!window.Telegram?.WebApp;
      const tg = hasWebApp ? window.Telegram!.WebApp : null;

      console.log("[TG Debug] Attempt:", attempts);
      console.log("[TG Debug] window.Telegram exists:", hasTelegram);
      console.log("[TG Debug] window.Telegram.WebApp exists:", hasWebApp);

      if (tg) {
        console.log("[TG Debug] initData:", tg.initData ? "present (" + tg.initData.length + " chars)" : "empty");
        console.log("[TG Debug] initDataUnsafe:", JSON.stringify(tg.initDataUnsafe));
        console.log("[TG Debug] initDataUnsafe.user:", JSON.stringify(tg.initDataUnsafe?.user));

        tg.ready();
        tg.expand();

        setupBackButton(() => {
          handleBack();
        });
      }

      const id = getTelegramUserId();
      console.log("[TG Debug] getTelegramUserId():", id);

      if (id) {
        setTelegramId(String(id));
        return true;
      }
      return false;
    };

    // Try immediately
    if (initTelegram()) {
      return () => {
        hideBackButton();
        hideMainButton();
      };
    }

    // Retry with polling if SDK not ready yet
    const interval = setInterval(() => {
      attempts++;
      if (initTelegram()) {
        clearInterval(interval);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        // Show debug info in error
        const tg = window.Telegram?.WebApp;
        const debugInfo = tg
          ? `initData: ${tg.initData ? "present" : "empty"}, user: ${JSON.stringify(tg.initDataUnsafe?.user)}`
          : "WebApp SDK not loaded";
        setError(`No se pudo obtener tu ID de Telegram. Debug: ${debugInfo}`);
        setStep("error");
      }
    }, 100);

    return () => {
      clearInterval(interval);
      hideBackButton();
      hideMainButton();
    };
  }, []);

  // Load user context when telegramId is available
  useEffect(() => {
    if (!telegramId) return;

    const loadContext = async () => {
      const url = `${API_URL}/api/webapp/user-context/${telegramId}`;
      console.log("[API Debug Pedido] Fetching:", url);

      try {
        const response = await fetch(url);
        console.log("[API Debug Pedido] Response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.log("[API Debug Pedido] Error response:", errorText);

          if (response.status === 404) {
            setError("Tu cuenta no está vinculada. Usa /start en el bot primero.");
          } else {
            setError(`Error del servidor: ${response.status}. ${errorText}`);
          }
          setStep("error");
          return;
        }

        const context: UserContext = await response.json();
        console.log("[API Debug Pedido] Context loaded:", context.name);
        setUserContext(context);
        setSignerName(context.name);

        // Load products
        const productsRes = await fetch(`${API_URL}/api/products?page_size=100`);
        if (productsRes.ok) {
          const data = await productsRes.json();
          setProducts(data.items.filter((p: Product) => p.active));
        }

        // If only one location, auto-select
        if (context.locations.length === 1) {
          setSelectedLocation(context.locations[0]);
          setStep("products");
        } else {
          setStep("location");
        }
      } catch (err) {
        console.error("[API Debug Pedido] Fetch error:", err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(`Error de conexión: ${errorMsg}\n\nURL: ${url}\nTelegram ID: ${telegramId}`);
        setStep("error");
      }
    };

    loadContext();
  }, [telegramId]);

  // Get geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          // Ignore errors, geolocation is optional
        }
      );
    }
  }, []);

  // ==================== HANDLERS ====================

  const handleBack = useCallback(() => {
    hapticFeedback("light");

    if (step === "location" || step === "error" || step === "success") {
      window.history.back();
    } else if (step === "products") {
      if (userContext && userContext.locations.length > 1) {
        setStep("location");
      } else {
        window.history.back();
      }
    } else if (step === "summary") {
      setStep("products");
    } else if (step === "signature") {
      setStep("summary");
    }
  }, [step, userContext]);

  const selectLocation = (location: Location) => {
    hapticFeedback("light");
    setSelectedLocation(location);
    setStep("products");
  };

  const updateQuantity = (product: Product, delta: number) => {
    hapticFeedback("light");

    setCart((prev) => {
      const newCart = new Map(prev);
      const existing = newCart.get(product.id);

      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) {
          newCart.delete(product.id);
        } else {
          newCart.set(product.id, { ...existing, quantity: newQty });
        }
      } else if (delta > 0) {
        newCart.set(product.id, { product, quantity: 1 });
      }

      return newCart;
    });
  };

  const getQuantity = (productId: number): number => {
    return cart.get(productId)?.quantity || 0;
  };

  const getTotalItems = (): number => {
    let total = 0;
    cart.forEach((item) => {
      total += item.quantity;
    });
    return total;
  };

  const goToSummary = () => {
    if (cart.size === 0) return;
    hapticFeedback("medium");
    setStep("summary");
  };

  const goToSignature = () => {
    hapticFeedback("medium");
    setStep("signature");
  };

  const handleSubmit = async () => {
    if (!signature || !signerName.trim() || !selectedLocation || !telegramId) {
      return;
    }

    hapticFeedback("success");
    setIsSubmitting(true);

    try {
      const items = Array.from(cart.values()).map((item) => ({
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        notes: item.notes || undefined,
      }));

      const response = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_id: selectedLocation.id,
          items,
          notes: orderNotes || undefined,
          signature_data: signature,
          signed_by_name: signerName,
          signature_latitude: geoLocation?.lat,
          signature_longitude: geoLocation?.lng,
          telegram_user_id: telegramId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Error al enviar pedido");
      }

      setStep("success");

      // Close WebApp after 3 seconds
      setTimeout(() => {
        const tg = getTelegramWebApp();
        if (tg) {
          tg.close();
        }
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar pedido");
      setStep("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==================== RENDER ====================

  // Loading
  if (step === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  // Error
  if (step === "error") {
    return (
      <div className="flex flex-col min-h-screen p-4">
        <header className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Pedir Producto</h1>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Error</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => window.history.back()}>Volver</Button>
        </div>
      </div>
    );
  }

  // Success
  if (step === "success") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h2 className="text-xl font-bold mb-2">Pedido Enviado</h2>
        <p className="text-muted-foreground mb-4">
          Tu pedido ha sido enviado correctamente.
          <br />
          Recibirás una notificación cuando sea aprobado.
        </p>
        <p className="text-sm text-muted-foreground">Cerrando en 3 segundos...</p>
      </div>
    );
  }

  // Location selection
  if (step === "location") {
    return (
      <div className="flex flex-col min-h-screen p-4">
        <header className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Pedir Producto</h1>
            <p className="text-sm text-muted-foreground">Selecciona ubicación</p>
          </div>
        </header>

        <div className="space-y-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            ¿Para qué ubicación es el pedido?
          </p>

          {userContext?.locations.map((location) => (
            <Card
              key={location.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => selectLocation(location)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{location.name}</p>
                  {location.address && (
                    <p className="text-sm text-muted-foreground">{location.address}</p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Products selection
  if (step === "products") {
    const totalItems = getTotalItems();

    return (
      <div className="flex flex-col min-h-screen">
        <header className="flex items-center gap-3 p-4 border-b sticky top-0 bg-background z-10">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Seleccionar Productos</h1>
            <p className="text-xs text-muted-foreground">{selectedLocation?.name}</p>
          </div>
        </header>

        <div className="flex-1 p-4 pb-24 space-y-3">
          {products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay productos disponibles</p>
            </div>
          ) : (
            products.map((product) => {
              const qty = getQuantity(product.id);

              return (
                <Card key={product.id} className={qty > 0 ? "border-primary" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium">{product.name}</p>
                        {product.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {product.description}
                          </p>
                        )}
                        {product.dosage && (
                          <Badge variant="secondary" className="mt-2">
                            {product.dosage}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(product, -1)}
                          disabled={qty === 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-medium">{qty}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(product, 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
          <Button
            className="w-full"
            size="lg"
            onClick={goToSummary}
            disabled={totalItems === 0}
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            Ver Resumen ({totalItems} productos)
          </Button>
        </div>
      </div>
    );
  }

  // Summary
  if (step === "summary") {
    const items = Array.from(cart.values());

    return (
      <div className="flex flex-col min-h-screen">
        <header className="flex items-center gap-3 p-4 border-b sticky top-0 bg-background z-10">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Resumen del Pedido</h1>
          </div>
        </header>

        <div className="flex-1 p-4 pb-24 space-y-4">
          {/* Location */}
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-medium">{selectedLocation?.name}</span>
          </div>

          {/* Items */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="font-medium">Tu pedido:</p>
              {items.map((item) => (
                <div key={item.product.id} className="flex justify-between text-sm">
                  <span>• {item.quantity}x {item.product.name}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Notas adicionales (opcional)</label>
            <textarea
              className="w-full p-3 border rounded-lg text-sm resize-none"
              rows={3}
              placeholder="Ej: Urgente para el lunes..."
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              maxLength={500}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
          <Button className="w-full" size="lg" onClick={goToSignature}>
            Firmar y Enviar
            <ChevronRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  // Signature - Fixed layout without scroll issues
  if (step === "signature") {
    const canSubmit = signature && signerName.trim().length >= 2 && !isSubmitting;

    return (
      <div className="fixed inset-0 flex flex-col bg-background">
        {/* Header - Fixed */}
        <header className="flex-shrink-0 flex items-center gap-3 p-4 border-b">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Firma de Autorización</h1>
          </div>
        </header>

        {/* Name input - Fixed */}
        <div className="flex-shrink-0 p-4 border-b">
          <label className="text-sm font-medium mb-2 block">
            Nombre del responsable
          </label>
          <Input
            type="text"
            placeholder="Tu nombre completo"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            className="text-base"
          />
        </div>

        {/* Signature area - Takes remaining space, no scroll */}
        <div
          className="flex-1 flex flex-col items-center justify-center p-4"
          style={{ touchAction: "none", overscrollBehavior: "none" }}
        >
          <SignaturePad
            signerName={signerName || "Responsable"}
            onSignatureChange={setSignature}
            width={Math.min(350, window.innerWidth - 32)}
            height={180}
            preventScroll={true}
          />
        </div>

        {/* Footer - Fixed */}
        <div className="flex-shrink-0 p-4 border-t space-y-2">
          <p className="text-xs text-center text-muted-foreground">
            Al firmar, autorizo este pedido para {selectedLocation?.name}
          </p>
          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Enviar Pedido
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
