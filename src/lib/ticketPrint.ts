import { orderTotal, type StallOrder } from './stallOps'

/** Open a print-friendly queue ticket for pickup. */
export function printQueueTicket(order: StallOrder): void {
  const total = orderTotal(order.lines)
  const lines = order.lines
    .map(
      (l) =>
        `<tr><td>${escapeHtml(String(l.qty))}×</td><td>${escapeHtml(l.name)}</td><td style="text-align:right">${formatEuro(l.price * l.qty)}</td></tr>`,
    )
    .join('')
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(order.label)}</title>
  <style>
    @page { margin: 8mm; size: 80mm auto; }
    body { font-family: Georgia, "Times New Roman", serif; color: #111; margin: 0; padding: 8px; }
    h1 { font-size: 28px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .sub { font-size: 12px; color: #444; margin-bottom: 12px; }
    .num { font-size: 56px; font-weight: 800; line-height: 1; margin: 10px 0 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    td { padding: 3px 0; vertical-align: top; }
    .total { margin-top: 12px; font-size: 18px; font-weight: 700; display: flex; justify-content: space-between; border-top: 2px dashed #333; padding-top: 8px; }
    .foot { margin-top: 14px; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <h1>Nasta Zentrum</h1>
  <div class="sub">Frisch · Gesund · Authentisch</div>
  <div class="num">${escapeHtml(order.label.replace(/^Customer\s+/i, '#'))}</div>
  <table>${lines}</table>
  <div class="total"><span>Total</span><span>${formatEuro(total)}</span></div>
  <div class="foot">Bitte warten · Thank you</div>
  <script>window.onload = function () { window.print(); setTimeout(function(){ window.close() }, 400); }</script>
</body>
</html>`

  const w = window.open('', '_blank', 'noopener,noreferrer,width=360,height=640')
  if (!w) {
    window.alert('Allow pop-ups to print the ticket.')
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
}

function formatEuro(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
