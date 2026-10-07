import { useSyncExternalStore } from 'react'
import italian from './it.json'
import english from './en.json'

export type AdminLanguage = 'it' | 'en'
const storageKey = 'iminati.admin.language'
const listeners = new Set<() => void>()
function readLanguage(): AdminLanguage {
  try {
    return localStorage.getItem(storageKey) === 'en' ? 'en' : 'it'
  } catch {
    return 'it'
  }
}
let language = readLanguage()
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export function setAdminLanguage(next: AdminLanguage) {
  language = next
  try {
    localStorage.setItem(storageKey, next)
  } catch {
    /* Session choice still works. */
  }
  listeners.forEach((listener) => listener())
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey || event.key === null) {
      language = readLanguage()
      listeners.forEach((listener) => listener())
    }
  })
}
export function useAdminLanguage() {
  return useSyncExternalStore(
    subscribe,
    () => language,
    () => 'it' as AdminLanguage,
  )
}
export function adminLocale() {
  return language === 'it' ? 'it-IT' : 'en-GB'
}
export function t(text: string, values: Record<string, string | number> = {}): string {
  // Notices set before a language switch may already contain translated text.
  const original = Object.entries(italian).find(([, value]) => value === text)?.[0]
  if (original) text = original
  if (language === 'en')
    return interpolate((english as Record<string, string>)[text] ?? text, values)
  const dictionary = italian as Record<string, string>
  if (dictionary[text]) return interpolate(dictionary[text], values)
  const trimmed = text.trim()
  if (dictionary[trimmed]) return interpolate(text.replace(trimmed, dictionary[trimmed]), values)
  return interpolate(text, values)
}
function interpolate(text: string, values: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  )
}
export function adminNumber(value: string | number) {
  return new Intl.NumberFormat(adminLocale(), { maximumFractionDigits: 3 }).format(Number(value))
}
export function LanguageSelector() {
  const selected = useAdminLanguage()
  return (
    <div className="admin-language-selector" role="group" aria-label={t('Language')}>
      <button
        type="button"
        lang="en"
        aria-label="English"
        aria-pressed={selected === 'en'}
        onClick={() => setAdminLanguage('en')}
      >
        EN
      </button>
      <span aria-hidden="true">/</span>
      <button
        type="button"
        lang="it"
        aria-label="Italiano"
        aria-pressed={selected === 'it'}
        onClick={() => setAdminLanguage('it')}
      >
        IT
      </button>
    </div>
  )
}
