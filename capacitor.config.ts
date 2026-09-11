import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Nasta Zentrum — Capacitor shell (Android / iOS).
 *
 * Default: load the live HTTPS site so /api, auth, and deploys stay in sync.
 * For a fully offline-bundled build, set CAP_BUNDLE=1 before sync
 * (still needs network for Supabase + Vercel APIs).
 */
const liveOrigin =
  (process.env.CAP_SERVER_URL || 'https://nastazentrum.vercel.app').replace(/\/$/, '')

const bundleLocal = process.env.CAP_BUNDLE === '1'

const config: CapacitorConfig = {
  appId: 'de.nastazentrum.tracker',
  appName: 'Nasta Zentrum',
  webDir: 'dist',
  // Relative asset paths work when bundling dist into the native shell
  // (also set vite base: './').
  android: {
    allowMixedContent: false,
    backgroundColor: '#0f1410',
  },
  ios: {
    scheme: 'Nasta Zentrum',
    backgroundColor: '#0f1410',
    limitsNavigationsToAppBoundDomains: true,
    contentInset: 'automatic',
  },
  server: bundleLocal
    ? {
        // Bundled SPA from webDir — HTTPS APIs only (no cleartext).
        androidScheme: 'https',
        cleartext: false,
      }
    : {
        url: liveOrigin,
        cleartext: false,
        androidScheme: 'https',
        // Only these hosts may leave the WebView / be navigated to.
        allowNavigation: [
          `${liveOrigin}/*`,
          'https://nasta-dashboard.vercel.app/*',
          'https://*.supabase.co/*',
          'https://formsubmit.co/*',
        ],
      },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#0f1410',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f1410',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
}

export default config
