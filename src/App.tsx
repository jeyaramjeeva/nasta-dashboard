import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { Layout } from './components/Layout'
import { RequireUploadAccess } from './components/RequireUploadAccess'
import { ThemeCloudSync } from './components/ThemeCloudSync'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { DemoModeProvider } from './context/DemoModeContext'
import { ExtrasProvider } from './context/ExtrasContext'
import { LocaleProvider } from './context/LocaleContext'
import { StallOpsProvider } from './context/StallOpsContext'
import { ThemeProvider } from './context/ThemeContext'
import { CalendarPage } from './pages/Calendar'
import { Cash } from './pages/Cash'
import { Dashboard } from './pages/Dashboard'
import { Events } from './pages/Events'
import { Insights } from './pages/Insights'
import { Orders } from './pages/Orders'
import { Partners } from './pages/Partners'
import { Plates } from './pages/Plates'
import { Playground } from './pages/Playground'
import { QuickAdd } from './pages/QuickAdd'
import { Stock } from './pages/Stock'
import { Upload } from './pages/Upload'
import { isDemoMode } from './lib/demoMode'

export default function App() {
  const demo = isDemoMode()
  return (
    <ThemeProvider>
      <LocaleProvider>
        <AuthProvider>
          <AuthGate>
            <DemoModeProvider>
              <ThemeCloudSync />
              <ExtrasProvider key={demo ? 'demo-x' : 'live-x'}>
                <StallOpsProvider key={demo ? 'demo-s' : 'live-s'}>
                  <DataProvider key={demo ? 'demo-d' : 'live-d'}>
                    <BrowserRouter>
                      <Routes>
                        <Route element={<Layout />}>
                          <Route index element={<Dashboard />} />
                          <Route path="events" element={<Events />} />
                          <Route path="calendar" element={<CalendarPage />} />
                          <Route path="partners" element={<Partners />} />
                          <Route path="cash" element={<Cash />} />
                          <Route path="insights" element={<Insights />} />
                          <Route path="stock" element={<Stock />} />
                          <Route path="orders" element={<Orders />} />
                          <Route path="plates" element={<Plates />} />
                          <Route path="playground" element={<Playground />} />
                          <Route
                            path="upload"
                            element={
                              <RequireUploadAccess>
                                <Upload />
                              </RequireUploadAccess>
                            }
                          />
                          <Route path="quick-add" element={<QuickAdd />} />
                          <Route path="*" element={<Navigate to="/" replace />} />
                        </Route>
                      </Routes>
                    </BrowserRouter>
                  </DataProvider>
                </StallOpsProvider>
              </ExtrasProvider>
            </DemoModeProvider>
          </AuthGate>
        </AuthProvider>
      </LocaleProvider>
    </ThemeProvider>
  )
}
