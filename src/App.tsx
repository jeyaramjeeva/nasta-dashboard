import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { Layout } from './components/Layout'
import { RequireAiHelper } from './components/RequireAiHelper'
import { RequireDeveloper } from './components/RequireDeveloper'
import { RequireFinanceAccess } from './components/RequireFinanceAccess'
import { RequireJeeva } from './components/RequireJeeva'
import { RequireUploadAccess } from './components/RequireUploadAccess'
import { ThemeCloudSync } from './components/ThemeCloudSync'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { DemoModeProvider } from './context/DemoModeContext'
import { ExtrasProvider } from './context/ExtrasContext'
import { LocaleProvider } from './context/LocaleContext'
import { EditUiProvider } from './context/EditUiContext'
import { SiteConfigProvider } from './context/SiteConfigContext'
import { StallModeProvider } from './context/StallModeContext'
import { BackgroundAiProvider } from './context/BackgroundAiContext'
import { StallOpsProvider } from './context/StallOpsContext'
import { ThemeProvider } from './context/ThemeContext'
import { Account } from './pages/Account'
import { AiCode } from './pages/AiCode'
import { AiHelper } from './pages/AiHelper'
import { CalendarPage } from './pages/Calendar'
import { Cash } from './pages/Cash'
import { CustomerDisplay } from './pages/CustomerDisplay'
import { Dashboard } from './pages/Dashboard'
import { DeveloperStudio } from './pages/DeveloperStudio'
import { Events } from './pages/Events'
import { FeaturePage } from './pages/FeaturePage'
import { Food } from './pages/Food'
import { BusinessCards } from './pages/BusinessCards'
import { Goals } from './pages/Goals'
import { Insights } from './pages/Insights'
import { MarketAnalysis } from './pages/MarketAnalysis'
import { InsightsHub } from './pages/InsightsHub'
import { Kitchen } from './pages/Kitchen'
import { MoneyHub } from './pages/MoneyHub'
import { Orders } from './pages/Orders'
import { Partners } from './pages/Partners'
import { PlanHub } from './pages/PlanHub'
import { Plates } from './pages/Plates'
import { Playground } from './pages/Playground'
import { LearnGerman } from './pages/LearnGerman'
import { PublicFaq } from './pages/PublicFaq'
import { PublicOrder } from './pages/PublicOrder'
import { PublicReview } from './pages/PublicReview'
import { QuickAdd } from './pages/QuickAdd'
import { Reviews } from './pages/Reviews'
import { Stock } from './pages/Stock'
import { Todos } from './pages/Todos'
import { Upload } from './pages/Upload'
import { isDemoMode } from './lib/demoMode'

function TeamApp() {
  const demo = isDemoMode()
  return (
    <AuthGate>
      <DemoModeProvider>
        <StallModeProvider>
          <ThemeCloudSync />
          <ExtrasProvider key={demo ? 'demo-x' : 'live-x'}>
            <StallOpsProvider key={demo ? 'demo-s' : 'live-s'}>
              <BackgroundAiProvider>
                <DataProvider key={demo ? 'demo-d' : 'live-d'}>
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

                      <Route path="kitchen" element={<Kitchen />}>
                        <Route index element={<Stock />} />
                        <Route path="food" element={<Food />} />
                        <Route path="cards" element={<BusinessCards />} />
                      </Route>

                      <Route path="plan" element={<PlanHub />}>
                        <Route index element={<CalendarPage />} />
                        <Route path="todos" element={<Todos />} />
                        <Route path="learn" element={<LearnGerman />} />
                      </Route>

                      <Route
                        path="money"
                        element={
                          <RequireFinanceAccess>
                            <MoneyHub />
                          </RequireFinanceAccess>
                        }
                      >
                        <Route index element={<Cash />} />
                        <Route path="partners" element={<Partners />} />
                      </Route>

                      <Route path="market-analysis" element={<MarketAnalysis />} />
                      <Route path="insights" element={<InsightsHub />}>
                        <Route
                          index
                          element={
                            <RequireFinanceAccess>
                              <Insights />
                            </RequireFinanceAccess>
                          }
                        />
                        <Route
                          path="goals"
                          element={
                            <RequireFinanceAccess>
                              <Goals />
                            </RequireFinanceAccess>
                          }
                        />
                        <Route path="reviews" element={<Reviews />} />
                      </Route>

                      {/* Legacy redirects */}
                      <Route path="stock" element={<Navigate to="/kitchen" replace />} />
                      <Route path="food" element={<Navigate to="/kitchen/food" replace />} />
                      <Route path="cards" element={<Navigate to="/kitchen/cards" replace />} />
                      <Route path="calendar" element={<Navigate to="/plan" replace />} />
                      <Route path="todos" element={<Navigate to="/plan/todos" replace />} />
                      <Route path="learn" element={<Navigate to="/plan/learn" replace />} />
                      <Route path="cash" element={<Navigate to="/money" replace />} />
                      <Route path="partners" element={<Navigate to="/money/partners" replace />} />
                      <Route path="goals" element={<Navigate to="/insights/goals" replace />} />
                      <Route path="reviews" element={<Navigate to="/insights/reviews" replace />} />
                      <Route path="intel" element={<Navigate to="/insights" replace />} />
                      <Route path="team" element={<Navigate to="/" replace />} />

                      <Route path="orders" element={<Orders />} />
                      <Route path="feature/:id" element={<FeaturePage />} />
                      <Route
                        path="studio"
                        element={
                          <RequireDeveloper>
                            <DeveloperStudio />
                          </RequireDeveloper>
                        }
                      />
                      <Route
                        path="plates"
                        element={
                          <RequireFinanceAccess>
                            <Plates />
                          </RequireFinanceAccess>
                        }
                      />
                      <Route path="playground" element={<Playground />} />
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
                            <RequireUploadAccess>
                              <QuickAdd />
                            </RequireUploadAccess>
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
                      <Route
                        path="ai-helper"
                        element={
                          <RequireAiHelper>
                            <AiHelper />
                          </RequireAiHelper>
                        }
                      />
                      <Route
                        path="ai-code"
                        element={
                          <RequireFinanceAccess>
                            <RequireUploadAccess>
                              <AiCode />
                            </RequireUploadAccess>
                          </RequireFinanceAccess>
                        }
                      />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                  </Routes>
                </DataProvider>
              </BackgroundAiProvider>
            </StallOpsProvider>
          </ExtrasProvider>
        </StallModeProvider>
      </DemoModeProvider>
    </AuthGate>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SiteConfigProvider>
          <EditUiProvider>
            <LocaleProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/review" element={<PublicReview />} />
                  <Route path="/order" element={<PublicOrder />} />
                  <Route path="/faq" element={<PublicFaq />} />
                  <Route path="/*" element={<TeamApp />} />
                </Routes>
              </BrowserRouter>
            </LocaleProvider>
          </EditUiProvider>
        </SiteConfigProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
