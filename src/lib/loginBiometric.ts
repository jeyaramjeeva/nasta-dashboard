import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric'
import { isNativeApp } from './nativeShell'

const SERVER = 'nastazentrum.app'

export async function biometricAvailable(): Promise<boolean> {
  if (!isNativeApp()) return false
  try {
    const { isAvailable, biometryType } = await NativeBiometric.isAvailable()
    return Boolean(isAvailable && biometryType !== BiometryType.NONE)
  } catch {
    return false
  }
}

export async function biometricLabel(): Promise<string> {
  if (!isNativeApp()) return 'Biometrics'
  try {
    const { biometryType } = await NativeBiometric.isAvailable()
    if (biometryType === BiometryType.FACE_ID) return 'Face ID'
    if (biometryType === BiometryType.TOUCH_ID) return 'Touch ID'
    if (biometryType === BiometryType.FINGERPRINT) return 'Fingerprint'
    if (biometryType === BiometryType.FACE_AUTHENTICATION) return 'Face unlock'
    return 'Biometrics'
  } catch {
    return 'Biometrics'
  }
}

/** Store account key + secret (PIN or password) behind OS biometrics. */
export async function saveBiometricSecret(
  accountKey: string,
  secret: string,
): Promise<void> {
  await NativeBiometric.setCredentials({
    username: accountKey,
    password: secret,
    server: SERVER,
  })
}

export async function unlockWithBiometric(): Promise<{
  accountKey: string
  secret: string
} | null> {
  try {
    const ok = await biometricAvailable()
    if (!ok) return null
    await NativeBiometric.verifyIdentity({
      reason: 'Unlock Nasta Zentrum',
      title: 'Nasta Zentrum',
      subtitle: 'Sign in',
      description: 'Use biometrics to unlock your saved login',
    })
    const creds = await NativeBiometric.getCredentials({ server: SERVER })
    if (!creds?.username || !creds.password) return null
    return { accountKey: creds.username, secret: creds.password }
  } catch {
    return null
  }
}

export async function deleteBiometricSecret(): Promise<void> {
  try {
    await NativeBiometric.deleteCredentials({ server: SERVER })
  } catch {
    /* ignore */
  }
}
