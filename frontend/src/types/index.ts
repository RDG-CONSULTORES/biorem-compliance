// Tipos TypeScript que corresponden a los schemas del backend

// ==================== ENUMS ====================

export type BusinessType =
  | "plaza"
  | "supermercado"
  | "casino"
  | "restaurante"
  | "hotel"
  | "hospital"
  | "otro"

export type ContactRole =
  | "admin"
  | "supervisor"
  | "operador"
  | "readonly"

export type ReminderStatus =
  | "pending"
  | "sent"
  | "completed"
  | "failed"
  | "escalated"
  | "cancelled"
  | "expired"

// ==================== CLIENT ====================

export interface Client {
  id: number
  name: string
  business_type: BusinessType
  address: string | null
  city: string | null
  state: string | null
  country: string
  postal_code: string | null
  latitude: number | null
  longitude: number | null
  phone: string | null
  email: string | null
  default_reminder_time: string
  default_frequency_days: number
  escalation_minutes: number
  notes: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface ClientCreate {
  name: string
  business_type?: BusinessType
  address?: string
  city?: string
  state?: string
  country?: string
  postal_code?: string
  latitude?: number
  longitude?: number
  phone?: string
  email?: string
  default_reminder_time?: string
  default_frequency_days?: number
  escalation_minutes?: number
  notes?: string
}

export interface ClientUpdate extends Partial<ClientCreate> {
  active?: boolean
}

// ==================== CONTACT ====================

export interface Contact {
  id: number
  client_id: number
  name: string
  phone: string | null
  email: string | null
  role: ContactRole
  telegram_id: string | null
  telegram_username: string | null
  telegram_first_name: string | null
  invite_code: string | null
  linked_at: string | null
  last_interaction_at: string | null
  notifications_enabled: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface ContactCreate {
  client_id: number
  name: string
  phone?: string
  email?: string
  role?: ContactRole
  notifications_enabled?: boolean
  quiet_hours_start?: string
  quiet_hours_end?: string
}

export interface ContactUpdate extends Partial<Omit<ContactCreate, 'client_id'>> {
  active?: boolean
}

export interface ContactWithInviteCode extends Contact {
  invite_code: string
}

// ==================== LOCATION ====================

export interface Location {
  id: number
  client_id: number
  name: string
  code: string | null
  description: string | null
  address: string | null
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  product_id: number | null
  frequency_days: number
  reminder_time: string
  reminder_days: string
  last_compliance_at: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface LocationCreate {
  client_id: number
  name: string
  code?: string
  description?: string
  address?: string
  city?: string
  state?: string
  latitude?: number
  longitude?: number
  product_id?: number
  frequency_days?: number
  reminder_time?: string
  reminder_days?: string
}

export interface LocationUpdate extends Partial<Omit<LocationCreate, 'client_id'>> {
  active?: boolean
}

// ==================== PRODUCT ====================

export interface Product {
  id: number
  name: string
  sku: string | null
  description: string | null
  application_instructions: string | null
  dosage: string | null
  frequency_recommended: number
  image_url: string | null
  thumbnail_url: string | null
  validation_keywords: string | null
  category: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface ProductCreate {
  name: string
  sku?: string
  description?: string
  application_instructions?: string
  dosage?: string
  frequency_recommended?: number
  image_url?: string
  thumbnail_url?: string
  validation_keywords?: string
  category?: string
}

export interface ProductUpdate extends Partial<ProductCreate> {
  active?: boolean
}

// ==================== COMPLIANCE ====================

export interface ComplianceRecord {
  id: number
  location_id: number
  contact_id: number | null
  reminder_id: number | null
  photo_url: string | null
  photo_file_id: string | null
  photo_received_at: string
  ai_validated: boolean | null
  ai_confidence: number | null
  ai_validated_at: string | null
  ai_summary: string | null
  ai_issues: string[] | null
  manual_validated: boolean | null
  manual_validated_at: string | null
  validated_by: number | null
  validation_notes: string | null
  is_valid: boolean | null
  contact_notes: string | null
  created_at: string
  updated_at: string
}

// ==================== PAGINATION ====================

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface PaginationParams {
  page?: number
  page_size?: number
  search?: string
}

// ==================== STATS ====================

export interface DashboardStats {
  total_clients: number
  total_contacts: number
  total_locations: number
  linked_contacts: number
  compliance_rate: number
  pending_reminders: number
}
