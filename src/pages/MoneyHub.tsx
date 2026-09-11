import { Outlet } from 'react-router-dom'
import { HubTabs } from '../components/HubTabs'
import { useLocale } from '../context/LocaleContext'

const TABS = [
  { to: '/money', end: true, labelEn: 'Cash box', labelDe: 'Cashbox' },
  { to: '/money/partners', labelEn: 'Partners', labelDe: 'Partner' },
]

export function MoneyHub() {
  const { locale } = useLocale()
  return (
    <>
      <HubTabs tabs={TABS} locale={locale} />
      <Outlet />
    </>
  )
}
