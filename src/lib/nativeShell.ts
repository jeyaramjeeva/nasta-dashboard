import { Capacitor } from '@capacitor/core'

/** True when running inside the Android / iOS Capacitor shell. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

export function nativePlatform(): 'ios' | 'android' | 'web' {
  const p = Capacitor.getPlatform()
  if (p === 'ios' || p === 'android') return p
  return 'web'
}

/**
 * Boot native chrome (status bar, splash, back button).
 * Safe to call on web — no-ops when plugins are unavailable.
 */
export async function initNativeShell(): Promise<void> {
  if (!isNativeApp()) return

  document.documentElement.classList.add('native-app')
  document.documentElement.dataset.platform = nativePlatform()

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Dark })
    if (nativePlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#0f1410' })
    }
  } catch {
    /* plugin optional in some builds */
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch {
    /* ignore */
  }

  try {
    const { App } = await import('@capacitor/app')
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back()
      else void App.exitApp()
    })
  } catch {
    /* ignore */
  }
}
