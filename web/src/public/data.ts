import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import type { DayHours } from '@/lib/business-hours'
export type Business = { name: string; description: string | null; address: string | null; phone: string | null; email: string | null; whatsapp: string | null; instagram: string | null; timezone: string; currency: string; hours: DayHours[] }
export type Item = { name: string; description?: string | null; duration_minutes?: number; price?: string; retail_price?: string; brand?: string | null; category?: string | null }
export type Page<T> = { items: T[]; total: number; limit: number; offset: number }
export type Review = { name: string; rating: number; comment: string; created_at: string }
export function usePublic<T>(path: string) {
  const [data, setData] = useState<T>(); const [error, setError] = useState(false); const [version, setVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController(); setData(undefined); setError(false)
    apiRequest<T>(path, { protected: false, signal: controller.signal, cache: 'no-store' }).then(value => { if (!controller.signal.aborted) setData(value) }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [path, version])
  return { data, error, retry: () => setVersion(v => v + 1) }
}
export function price(value: string | undefined, currency: string | undefined) {
  if (value === undefined || !currency) return 'Price information unavailable'
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value)) }
  catch { return `${value} ${currency}` }
}
export function contactLinks(b: Business) {
  const links: { label: string; href: string }[] = []
  const phone = (value: string | null) => value && /^\+?[\d\s().-]+$/.test(value) && value.replace(/\D/g, '').length >= 7 && value.replace(/\D/g, '').length <= 15 ? value.replace(/[^\d+]/g, '') : null
  const telephone = phone(b.phone), whatsapp = phone(b.whatsapp)
  if (telephone) links.push({ label: 'Call', href: `tel:${telephone}` })
  if (b.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) links.push({ label: 'Email', href: `mailto:${encodeURIComponent(b.email)}` })
  if (whatsapp) links.push({ label: 'WhatsApp', href: `https://wa.me/${whatsapp.replace(/\D/g, '')}` })
  const instagram = b.instagram?.trim()
  let handle = instagram?.replace(/^@/, '')
  if (instagram?.startsWith('https://')) { try { const url = new URL(instagram); handle = ['instagram.com', 'www.instagram.com'].includes(url.hostname) && !url.port && !url.username && !url.password && !url.search && !url.hash ? url.pathname.replace(/^\//, '').replace(/\/$/, '') : undefined } catch { handle = undefined } }
  if (handle && /^[A-Za-z0-9_.]{1,30}$/.test(handle) && !['explore', 'accounts', 'reel', 'reels', 'p'].includes(handle)) links.push({ label: 'Instagram', href: `https://www.instagram.com/${handle}/` })
  if (b.address?.trim()) links.push({ label: 'Directions', href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.address)}` })
  return links
}
