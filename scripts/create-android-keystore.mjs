/**
 * Create a release keystore for Play Store signing (run once, keep offline).
 * Usage: node scripts/create-android-keystore.mjs
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, 'android', 'nasta-release.keystore')
const props = path.join(root, 'android', 'keystore.properties')

async function main() {
  if (fs.existsSync(out)) {
    console.error('Keystore already exists:', out)
    process.exit(1)
  }

  const rl = readline.createInterface({ input, output })
  const storePass = await rl.question('Keystore password (min 6 chars): ')
  const alias = (await rl.question('Key alias [nasta]: ')) || 'nasta'
  const keyPass = (await rl.question('Key password [same as store]: ')) || storePass
  rl.close()

  if (!storePass || storePass.length < 6) {
    console.error('Password too short')
    process.exit(1)
  }

  const keytool =
    process.env.JAVA_HOME
      ? path.join(process.env.JAVA_HOME, 'bin', 'keytool')
      : 'keytool'

  execFileSync(
    keytool,
    [
      '-genkeypair',
      '-v',
      '-keystore',
      out,
      '-alias',
      alias,
      '-keyalg',
      'RSA',
      '-keysize',
      '2048',
      '-validity',
      '10000',
      '-storepass',
      storePass,
      '-keypass',
      keyPass,
      '-dname',
      'CN=Nasta Zentrum, OU=Mobile, O=Nasta Zentrum, L=Germany, C=DE',
    ],
    { stdio: 'inherit' },
  )

  fs.writeFileSync(
    props,
    [
      `storeFile=nasta-release.keystore`,
      `storePassword=${storePass}`,
      `keyAlias=${alias}`,
      `keyPassword=${keyPass}`,
      '',
    ].join('\n'),
    'utf8',
  )

  console.log('\nCreated:')
  console.log(' ', out)
  console.log(' ', props)
  console.log('\nNEVER commit these files. Back them up offline.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
