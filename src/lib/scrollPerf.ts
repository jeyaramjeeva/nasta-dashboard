/** Mark scrolling so CSS can drop expensive blur for a moment. */
export function initScrollPerf(): void {
  if (typeof window === 'undefined') return
  let timer = 0
  const onScroll = () => {
    document.documentElement.classList.add('is-scrolling')
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      document.documentElement.classList.remove('is-scrolling')
    }, 120)
  }
  window.addEventListener('scroll', onScroll, { passive: true, capture: true })
}
