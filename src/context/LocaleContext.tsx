import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  isLocale,
  nextLocale,
  t,
  type I18nKey,
  type Locale,
} from '../lib/i18n'
import { useSiteConfig } from './SiteConfigContext'

interface LocaleContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  toggleLocale: () => void
  tr: (key: I18nKey) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)
const KEY = 'nasta-locale'

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { config } = useSiteConfig()
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem(KEY)
    return isLocale(saved) ? saved : 'en'
  })

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    localStorage.setItem(KEY, l)
    document.documentElement.lang = l === 'ka' ? 'kn' : l
  }, [])

  const toggleLocale = useCallback(() => {
    setLocale(nextLocale(locale))
  }, [locale, setLocale])

  const copyMap = useMemo(() => {
    const m = new Map<string, { en: string; de: string; hidden: boolean }>()
    for (const c of config.copy) m.set(c.key, c)
    return m
  }, [config.copy])

  const tr = useCallback(
    (key: I18nKey) => {
      const o = copyMap.get(key)
      if (o?.hidden) return ''
      if (locale === 'de' && o?.de?.trim()) return o.de
      if (o?.en?.trim()) return o.en
      return t(locale, key)
    },
    [locale, copyMap],
  )

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
