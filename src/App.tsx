import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { Layout } from './components/Layout'
import { RequireFinanceAccess } from './components/RequireFinanceAccess'
import { RequireUploadAccess } from './components/RequireUploadAccess'
import { ThemeCloudSync } from './components/ThemeCloudSync'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { DemoModeProvider } from './context/DemoModeContext'
import { ExtrasProvider } from './context/ExtrasContext'
import { LocaleProvider } from './context/LocaleContext'
import { StallModeProvider } from './context/StallModeContext'
import { StallOpsProvider } from './context/StallOpsContext'
import { ThemeProvider } from './context/ThemeContext'
import { Account } from './pages/Account'
import { CalendarPage } from './pages/Calendar'
import { Cash } from './pages/Cash'
import { CustomerDisplay } from './pages/CustomerDisplay'
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
              <StallModeProvider>
                <ThemeCloudSync />
                <ExtrasProvider key={demo ? 'demo-x' : 'live-x'}>
                  <StallOpsProvider key={demo ? 'demo-s' : 'live-s'}>
                    <DataProvider key={demo ? 'demo-d' : 'live-d'}>
                      <BrowserRouter>
                        <Routes>
                          <Route path="display" element={<CustomerDisplay />} />
                          <Route element={<Layout />}>
                            <Route
                              index
                              element={
                                <RequireFinanceAccess>
                                  <Dashboard />
                                </RequireFinanceAccess>
                              }
                            />
                            <Route
                              path="events"
                              element={
                                <RequireFinanceAccess>
                                  <Events />
                                </RequireFinanceAccess>
                              }
                            />
                            <Route path="calendar" element={<CalendarPage />} />
                            <Route
                              path="partners"
                              element={
                                <RequireFinanceAccess>
                                  <Partners />
                                </RequireFinanceAccess>
                              }
                            />
                            <Route
                              path="cash"
                              element={
                                <RequireFinanceAccess>
                                  <Cash />
                                </RequireFinanceAccess>
                              }
                            />
                            <Route
                              path="insights"
                              element={
                                <RequireFinanceAccess>
                                  <Insights />
                                </RequireFinanceAccess>
                              }
                            />
                            <Route path="stock" element={<Stock />} />
                            <Route path="orders" element={<Orders />} />
                            <Route
                              path="plates"
                              element={
                                <RequireFinanceAccess>
                                  <Plates />
                                </RequireFinanceAccess>
                              }
                            />
                            <Route
                              path="playground"
                              element={
                                <RequireFinanceAccess>
                                  <Playground />
                                </RequireFinanceAccess>
                              }
                            />
                            <Route
                              path="upload"
                              element={
                                <RequireFinanceAccess>
                                  <RequireUploadAccess>
                                    <Upload />
                                  </RequireUploadAccess>
                                </RequireFinanceAccess>
                              }
                            />
                            <Route
                              path="quick-add"
                              element={
                                <RequireFinanceAccess>
                                  <QuickAdd />
                                </RequireFinanceAccess>
                              }
                            />
                            <Route
                              path="account"
                              element={
                                <RequireFinanceAccess>
                                  <Account />
                                </RequireFinanceAccess>
                              }
                            />
                            <Route path="*" element={<Navigate to="/" replace />} />
                          </Route>
                        </Routes>
                      </BrowserRouter>
                    </DataProvider>
                  </StallOpsProvider>
                </ExtrasProvider>
              </StallModeProvider>
            </DemoModeProvider>
          </AuthGate>
        </AuthProvider>
      </LocaleProvider>
    </ThemeProvider>
  )
}
