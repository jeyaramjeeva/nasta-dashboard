export interface EventRow {
  id: string
  name: string
  location: string
  startDate: string | null
  endDate: string | null
  month: string | null
  days: number
  fee: number
  status: string
}

export interface Transaction {
  date: string | null
  month: string | null
  eventId: string
  purchaseDate: string | null
  type: string
  costType: string
  category: string
  description: string
  amount: number
  person: string
  status: string
}

export interface CashBoxRow {
  eventId: string
  date: string | null
  transactionType: string
  description: string
  inAmount: number
  outAmount: number
  balance: number | null
}

export interface Denomination {
  label: string
  count: number
}

export interface PartnerRow {
  name: string
  paid: number
  returned: number
  balance: number
}

/** Before/after denomination counts from Event Cash Box sheet. */
export interface EventCashCount {
  eventId: string
  before: Denomination[]
  after: Denomination[]
  startOfDay: Denomination[]
  beforePaypal: number
  afterPaypal: number
  beforeCash: number
  afterCash: number
}

export interface Snapshot {
  uploadedAt: string
  sourceFile: string
  events: EventRow[]
  transactions: Transaction[]
  cashBox: CashBoxRow[]
  denominations: Denomination[]
  /** PayPal balance from Cash Box sheet (Excel L16). */
  paypalBalance: number
  partners: PartnerRow[]
  /** Per-event before/after cash counts. */
  eventCashCounts?: EventCashCount[]
  /** Coin reserve box denominations. */
  coinReserve?: Denomination[]
  coinReserveTotal?: number
  mainBoxTotal?: number
  allBoxesTotal?: number
}

export interface EventMetrics {
  id: string
  name: string
  location: string
  startDate: string | null
  endDate: string | null
  days: number
  status: string
  income: number
  expense: number
  profit: number
  incomePerDay: number
  fee: number
  grocery: number
  transport: number
  otherExpense: number
  /** Income needed to break even on fee+grocery+transport. */
  breakEven: number
  /** income - breakEven operating costs (fee+grocery+transport). */
  operatingProfit: number
  margin: number
}

export interface LocationScore {
  location: string
  income: number
  expense: number
  profit: number
  days: number
  incomePerDay: number
  margin: number
  events: string[]
  rank: number
}

export interface SettlementPlan {
  name: string
  /** Still owed for expenses they put in (paid − returned). */
  owed: number
  shareOfTotal: number
  suggestedPay: number
  /** Step 1: repay what they put in. */
  reimbursement?: number
  /** Step 2: equal (or %) share of leftover profit. */
  profitShare?: number
}

export interface EventForecast {
  type: string
  days: number
  sampleSize: number
  expectedIncome: number
  incomePerDay: number
  groceryBudget: number
  feeEstimate: number
  transportEstimate: number
  expectedNet: number
  breakEven: number
}

export type AlertKind =
  | 'partner_owed'
  | 'cash_mismatch'
  | 'upcoming_empty'
  | 'negative_net'
  | 'unpaid'
  | 'duplicate_expense'

export interface SmartAlert {
  kind: AlertKind
  severity: 'info' | 'warn' | 'critical'
  message: string
  meta?: Record<string, string | number>
}

export interface DuplicateExpenseHit {
  date: string
  person: string
  amount: number
  count: number
  descriptions: string[]
  eventIds: string[]
}

export interface DashboardMetrics {
  totalIncome: number
  totalExpense: number
  net: number
  profitMargin: number
  settlementsPaid: number
  partnerOwed: number
  eventsCompleted: number
  eventsUpcoming: number
  monthly: { month: string; income: number; expense: number; net: number }[]
  byCategory: { category: string; amount: number }[]
  byEvent: EventMetrics[]
  byLocation: LocationScore[]
  byEventType: { type: string; income: number; days: number; incomePerDay: number; count: number; avgGroceryPerDay: number; avgFee: number; avgTransport: number }[]
  partners: PartnerRow[]
  cashExpected: number
  cashCounted: number
  paypalBalance: number
  cashWithPaypal: number
  cashMismatch: number
  coinReserveTotal: number
  mainBoxTotal: number
  allBoxesTotal: number
  alerts: SmartAlert[]
  settlementPlan: SettlementPlan[]
  duplicateExpenses: DuplicateExpenseHit[]
}

export type EventStatusFilter = 'all' | 'completed' | 'upcoming'

export interface MetricsFilter {
  months?: string[]
  eventTypes?: string[]
  category?: string | null
  /** Limit KPIs / counts to completed or upcoming stalls. */
  status?: EventStatusFilter
}

export interface SavedView {
  id: string
  name: string
  filter: MetricsFilter
  createdAt: string
}
