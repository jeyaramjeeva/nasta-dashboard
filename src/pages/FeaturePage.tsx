import { Sparkles } from 'lucide-react'
import { Navigate, useParams } from 'react-router-dom'
import { MotionCard } from '../components/MotionCard'
import { useLocale } from '../context/LocaleContext'
import { useSiteConfig } from '../context/SiteConfigContext'

export function FeaturePage() {
  const { id } = useParams()
  const { config } = useSiteConfig()
  const { locale } = useLocale()
  const feature = config.features.find((f) => f.id === id && f.visible)

  if (!feature) return <Navigate to="/" replace />

  const title = locale === 'de' ? feature.labelDe : feature.labelEn
  const body = locale === 'de' ? feature.bodyDe : feature.bodyEn

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <Sparkles size={22} style={{ verticalAlign: -3, marginRight: 8 }} />
            {title}
          </h1>
        </div>
      </div>
      <MotionCard interactive={false}>
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{body}</div>
      </MotionCard>
    </>
  )
}
