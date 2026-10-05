export type Context = { timezone: string; currency: string }
export type Page<T> = { items: T[]; total: number; limit: number; offset: number }
export type Client = {
  id: string
  first_name: string
  last_name: string
  email?: string | null
  phone?: string | null
}
export type CatalogService = {
  id: string
  name: string
  price: string
  duration_minutes: number
  is_active: boolean
}
export type Barber = { id: string; name: string; is_active: boolean }
export type Snapshot = { service_id: string; name: string; price: string; duration_minutes: number }
export type Totals = {
  calculated_duration_minutes: number
  calculated_price: string
  final_duration_minutes: number
  final_price: string
  scheduled_end: string
  services: Snapshot[]
}
export type Appointment = Totals & {
  id: string
  client: Client
  barber: Barber | null
  scheduled_start: string
  status: string
  main_service: Snapshot | null
  appointment_notes: string | null
  visit_notes?: string | null
  products: { product_id?: string; name: string; quantity: string; usage_type: string }[]
}
