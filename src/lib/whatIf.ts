import type { EventMetrics } from '../types'

export interface FeeWhatIf {
  eventId: string
  name: string
  actualFee: number
  whatIfFee: number
  income: number
  grocery: number
  transport: number
  actualBreakEven: number
  whatIfBreakEven: number
  actualOperatingProfit: number
  whatIfOperatingProfit: number
  beatsBreakEven: boolean
  deltaVsActual: number
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function feeWhatIf(event: EventMetrics, whatIfFee: number): FeeWhatIf {
  const fee = Math.max(0, whatIfFee)
  const actualBreakEven = round2(event.fee + event.grocery + event.transport)
  const whatIfBreakEven = round2(fee + event.grocery + event.transport)
  const actualOperatingProfit = round2(event.income - actualBreakEven)
  const whatIfOperatingProfit = round2(event.income - whatIfBreakEven)
  return {
    eventId: event.id,
    name: event.name,
    actualFee: event.fee,
    whatIfFee: fee,
    income: event.income,
    grocery: event.grocery,
    transport: event.transport,
    actualBreakEven,
    whatIfBreakEven,
    actualOperatingProfit,
    whatIfOperatingProfit,
    beatsBreakEven: whatIfOperatingProfit >= 0,
    deltaVsActual: round2(whatIfOperatingProfit - actualOperatingProfit),
  }
}
