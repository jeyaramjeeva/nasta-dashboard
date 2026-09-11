import { Outlet } from 'react-router-dom'
import { HubTabs } from '../components/HubTabs'
import { useLocale } from '../context/LocaleContext'

const TABS = [
  { to: '/plan', end: true, labelEn: 'Calendar', labelDe: 'Kalender' },
  { to: '/plan/todos', labelEn: 'To-dos', labelDe: 'Aufgaben' },
  { to: '/plan/learn', labelEn: 'Learn DE', labelDe: 'Deutsch üben' },
]

export function PlanHub() {
  const { locale } = useLocale()
  return (
    <>
      <HubTabs tabs={TABS} locale={locale} />
      <Outlet />
    </>
  )
}
