import { Outlet } from 'react-router-dom'
import { HubTabs } from '../components/HubTabs'
import { useLocale } from '../context/LocaleContext'

const TABS = [
  { to: '/kitchen', end: true, labelEn: 'Stock', labelDe: 'Lager' },
  { to: '/kitchen/food', labelEn: 'Food', labelDe: 'Essen' },
  { to: '/kitchen/cards', labelEn: 'Cards', labelDe: 'Karten' },
]

export function Kitchen() {
  const { locale } = useLocale()
  return (
    <>
      <HubTabs tabs={TABS} locale={locale} />
      <Outlet />
    </>
  )
}
