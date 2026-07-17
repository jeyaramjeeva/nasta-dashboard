import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { Layout } from './components/Layout'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { LocaleProvider } from './context/LocaleContext'
import { ThemeProvider } from './context/ThemeContext'
import { CalendarPage } from './pages/Calendar'
import { Cash } from './pages/Cash'
import { Dashboard } from './pages/Dashboard'
import { Events } from './pages/Events'
import { Insights } from './pages/Insights'
import { Partners } from './pages/Partners'
import { QuickAdd } from './pages/QuickAdd'
import { Upload } from './pages/Upload'

export default function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <AuthProvider>
          <AuthGate>
            <DataProvider>
              <BrowserRouter>
                <Routes>
                  <Route element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="events" element={<Events />} />
                    <Route path="calendar" element={<CalendarPage />} />
                    <Route path="partners" element={<Partners />} />
                    <Route path="cash" element={<Cash />} />
                    <Route path="insights" element={<Insights />} />
                    <Route path="upload" element={<Upload />} />
                    <Route path="quick-add" element={<QuickAdd />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </DataProvider>
          </AuthGate>
        </AuthProvider>
      </LocaleProvider>
    </ThemeProvider>
  )
}
