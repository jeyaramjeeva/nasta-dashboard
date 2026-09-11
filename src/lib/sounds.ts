/** Soft UI sounds via Web Audio (no asset files). */

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) ctx = new AudioContext()
    return ctx
  } catch {
    return null
  }
}

async function resume(ac: AudioContext) {
  if (ac.state === 'suspended') {
    try {
      await ac.resume()
    } catch {
      /* ignore */
    }
  }
}

/** Soft rising chime — use after claiming a customer order. */
export async function playClaimChime() {
  const ac = audio()
  if (!ac) return
  await resume(ac)
  const now = ac.currentTime
  const notes = [523.25, 659.25, 783.99] // C5 E5 G5
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02 + i * 0.05)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35 + i * 0.08)
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.start(now + i * 0.07)
    osc.stop(now + 0.45 + i * 0.08)
  })
}

/** Soft low hush — use when a mid-day sales crash alert appears. */
export async function playCrashHush() {
  const ac = audio()
  if (!ac) return
  await resume(ac)
  const now = ac.currentTime
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  const filter = ac.createBiquadFilter()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(220, now)
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.7)
  filter.type = 'lowpass'
  filter.frequency.value = 400
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.06, now + 0.05)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85)
  osc.connect(filter)
  filter.connect(gain)
  gain.connect(ac.destination)
  osc.start(now)
  osc.stop(now + 0.9)
}
