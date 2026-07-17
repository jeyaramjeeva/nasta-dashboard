import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { t, type I18nKey, type Locale } from '../lib/i18n'

interface LocaleContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  toggleLocale: () => void
  tr: (key: I18nKey) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)
const KEY = 'nasta-locale'

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem(KEY)
    return saved === 'de' || saved === 'en' ? saved : 'en'
  })

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    localStorage.setItem(KEY, l)
    document.documentElement.lang = l
  }, [])

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'en' ? 'de' : 'en')
  }, [locale, setLocale])

  const tr = useCallback((key: I18nKey) => t(locale, key), [locale])

  const value = useMemo(
    () => ({ locale, setLocale, toggleLocale, tr }),
    [locale, setLocale, toggleLocale, tr],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}
