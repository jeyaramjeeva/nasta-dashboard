import { Navigate, Outlet } from 'react-router-dom'
import { HubTabs } from '../components/HubTabs'
import { useLocale } from '../context/LocaleContext'
import { useStallMode } from '../context/StallModeContext'

const TABS = [
  { to: '/insights', end: true, labelEn: 'Insights', labelDe: 'Einblicke' },
  { to: '/insights/goals', labelEn: 'Goals', labelDe: 'Ziele' },
  { to: '/insights/reviews', labelEn: 'Reviews', labelDe: 'Bewertungen' },
]

export function InsightsHub() {
  const { locale } = useLocale()
  const { isStall } = useStallMode()

  if (isStall) {
    return <Navigate to="/orders" replace />
  }

  return (
    <>
      <HubTabs tabs={TABS} locale={locale} />
      <Outlet />
    </>
  )
}
