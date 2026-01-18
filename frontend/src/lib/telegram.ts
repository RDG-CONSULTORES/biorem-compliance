/**
 * Telegram Web App SDK Utilities
 *
 * Este módulo proporciona tipos y utilidades para trabajar con
 * Telegram Mini Apps (Web Apps).
 *
 * Documentación oficial:
 * https://core.telegram.org/bots/webapps
 */

// ==================== TIPOS ====================

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramChat {
  id: number;
  type: "group" | "supergroup" | "channel";
  title: string;
  username?: string;
  photo_url?: string;
}

export interface WebAppInitData {
  query_id?: string;
  user?: TelegramUser;
  receiver?: TelegramUser;
  chat?: TelegramChat;
  chat_type?: "sender" | "private" | "group" | "supergroup" | "channel";
  chat_instance?: string;
  start_param?: string;
  can_send_after?: number;
  auth_date: number;
  hash: string;
}

export interface ThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

export interface MainButton {
  text: string;
  color: string;
  textColor: string;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;
  setText: (text: string) => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
  show: () => void;
  hide: () => void;
  enable: () => void;
  disable: () => void;
  showProgress: (leaveActive?: boolean) => void;
  hideProgress: () => void;
}

export interface BackButton {
  isVisible: boolean;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
  show: () => void;
  hide: () => void;
}

export interface HapticFeedback {
  impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
  notificationOccurred: (type: "error" | "success" | "warning") => void;
  selectionChanged: () => void;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: WebAppInitData;
  version: string;
  platform: string;
  colorScheme: "light" | "dark";
  themeParams: ThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  MainButton: MainButton;
  BackButton: BackButton;
  HapticFeedback: HapticFeedback;
  ready: () => void;
  expand: () => void;
  close: () => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  sendData: (data: string) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  showPopup: (params: {
    title?: string;
    message: string;
    buttons?: Array<{
      id?: string;
      type?: "default" | "ok" | "close" | "cancel" | "destructive";
      text?: string;
    }>;
  }, callback?: (buttonId: string) => void) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  showScanQrPopup: (params: { text?: string }, callback?: (text: string) => boolean) => void;
  closeScanQrPopup: () => void;
  readTextFromClipboard: (callback?: (text: string | null) => void) => void;
  requestWriteAccess: (callback?: (granted: boolean) => void) => void;
  requestContact: (callback?: (shared: boolean) => void) => void;
  setHeaderColor: (color: "bg_color" | "secondary_bg_color" | string) => void;
  setBackgroundColor: (color: "bg_color" | "secondary_bg_color" | string) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

// ==================== UTILIDADES ====================

/**
 * Obtiene la instancia de Telegram WebApp
 * @returns TelegramWebApp o null si no está disponible
 */
export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp || null;
}

/**
 * Verifica si la app está corriendo dentro de Telegram
 */
export function isRunningInTelegram(): boolean {
  const tg = getTelegramWebApp();
  return tg !== null && tg.initData !== "";
}

/**
 * Obtiene los datos del usuario actual
 */
export function getTelegramUser(): TelegramUser | null {
  const tg = getTelegramWebApp();
  return tg?.initDataUnsafe?.user || null;
}

/**
 * Obtiene el ID del usuario de Telegram
 */
export function getTelegramUserId(): number | null {
  return getTelegramUser()?.id || null;
}

/**
 * Obtiene el initData para validación en el servidor
 */
export function getInitData(): string {
  const tg = getTelegramWebApp();
  return tg?.initData || "";
}

/**
 * Configura el botón principal de Telegram
 */
export function setupMainButton(options: {
  text: string;
  onClick: () => void;
  color?: string;
  textColor?: string;
}): void {
  const tg = getTelegramWebApp();
  if (!tg) return;

  const { MainButton } = tg;

  MainButton.setText(options.text);
  MainButton.onClick(options.onClick);

  if (options.color) {
    MainButton.color = options.color;
  }
  if (options.textColor) {
    MainButton.textColor = options.textColor;
  }

  MainButton.show();
}

/**
 * Oculta el botón principal
 */
export function hideMainButton(): void {
  const tg = getTelegramWebApp();
  tg?.MainButton.hide();
}

/**
 * Configura el botón de retroceso
 */
export function setupBackButton(onClick: () => void): void {
  const tg = getTelegramWebApp();
  if (!tg) return;

  tg.BackButton.onClick(onClick);
  tg.BackButton.show();
}

/**
 * Oculta el botón de retroceso
 */
export function hideBackButton(): void {
  const tg = getTelegramWebApp();
  tg?.BackButton.hide();
}

/**
 * Muestra una alerta nativa de Telegram
 */
export function showAlert(message: string): Promise<void> {
  return new Promise((resolve) => {
    const tg = getTelegramWebApp();
    if (tg) {
      tg.showAlert(message, resolve);
    } else {
      alert(message);
      resolve();
    }
  });
}

/**
 * Muestra un diálogo de confirmación nativo de Telegram
 */
export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const tg = getTelegramWebApp();
    if (tg) {
      tg.showConfirm(message, resolve);
    } else {
      resolve(confirm(message));
    }
  });
}

/**
 * Vibración háptica para feedback
 */
export function hapticFeedback(
  type: "success" | "error" | "warning" | "light" | "medium" | "heavy"
): void {
  const tg = getTelegramWebApp();
  if (!tg) return;

  switch (type) {
    case "success":
    case "error":
    case "warning":
      tg.HapticFeedback.notificationOccurred(type);
      break;
    default:
      tg.HapticFeedback.impactOccurred(type);
  }
}

/**
 * Cierra la WebApp y envía datos al bot
 */
export function closeWebApp(data?: string): void {
  const tg = getTelegramWebApp();
  if (!tg) return;

  if (data) {
    tg.sendData(data);
  }
  tg.close();
}

/**
 * Obtiene el esquema de color actual
 */
export function getColorScheme(): "light" | "dark" {
  const tg = getTelegramWebApp();
  return tg?.colorScheme || "light";
}

/**
 * Hook-like function para obtener colores del tema de Telegram
 */
export function getThemeColors(): {
  bgColor: string;
  textColor: string;
  hintColor: string;
  linkColor: string;
  buttonColor: string;
  buttonTextColor: string;
  secondaryBgColor: string;
} {
  const tg = getTelegramWebApp();
  const params = tg?.themeParams || {};

  return {
    bgColor: params.bg_color || "#ffffff",
    textColor: params.text_color || "#000000",
    hintColor: params.hint_color || "#999999",
    linkColor: params.link_color || "#2481cc",
    buttonColor: params.button_color || "#93d500",
    buttonTextColor: params.button_text_color || "#ffffff",
    secondaryBgColor: params.secondary_bg_color || "#f0f0f0",
  };
}
