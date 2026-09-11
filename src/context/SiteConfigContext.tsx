import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import {
  applySiteTheme,
  defaultSiteConfig,
  fetchSiteConfig,
  loadLocalSiteConfig,
  normalizeInlineEdit,
  publishSiteConfig,
  type SiteConfig,
  type SiteInlineEdit,
} from '../lib/siteConfig'

interface SiteConfigContextValue {
  config: SiteConfig
  loading: boolean
  refresh: () => Promise<void>
  save: (next: SiteConfig) => Promise<SiteConfig>
  /** Merge one inline edit and publish (Developer pens). */
  saveInlineEdit: (id: string, edit: SiteInlineEdit | null) => Promise<void>
}

const SiteConfigContext = createContext<SiteConfigContextValue | null>(null)

export function SiteConfigProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [config, setConfig] = useState<SiteConfig>(() => loadLocalSiteConfig())
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const next = await fetchSiteConfig()
      setConfig(next)
      applySiteTheme(next.theme)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, user?.name])

  useEffect(() => {
    applySiteTheme(config.theme)
  }, [config.theme])

  const save = useCallback(
    async (next: SiteConfig) => {
      const saved = await publishSiteConfig(next, user)
      setConfig(saved)
      applySiteTheme(saved.theme)
      return saved
    },
    [user],
  )

  const saveInlineEdit = useCallback(
    async (id: string, edit: SiteInlineEdit | null) => {
      const key = id.trim().slice(0, 120)
      if (!key) return
      const inlineEdits = { ...config.inlineEdits }
      if (edit == null) {
        delete inlineEdits[key]
      } else {
        const normalized = normalizeInlineEdit(edit)
        if (normalized) inlineEdits[key] = normalized
        else delete inlineEdits[key]
      }
      await save({
        ...config,
        inlineEdits,
        updatedAt: new Date().toISOString(),
      })
    },
    [config, save],
  )

  const value = useMemo(
    () => ({ config, loading, refresh, save, saveInlineEdit }),
    [config, loading, refresh, save, saveInlineEdit],
  )

  return <SiteConfigContext.Provider value={value}>{children}</SiteConfigContext.Provider>
}

export function useSiteConfig() {
  const ctx = useContext(SiteConfigContext)
  if (!ctx) {
    return {
      config: defaultSiteConfig(),
      loading: false,
      refresh: async () => undefined,
      save: async (n: SiteConfig) => n,
      saveInlineEdit: async () => undefined,
    } satisfies SiteConfigContextValue
  }
  return ctx
}
