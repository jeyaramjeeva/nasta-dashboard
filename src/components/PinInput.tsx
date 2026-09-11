import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { LOGIN_PIN_DIGITS } from '../lib/loginPin'

export function PinInput({
  value,
  onChange,
  autoFocus,
  required,
  id,
  autoComplete = 'one-time-code',
}: {
  value: string
  onChange: (digits: string) => void
  autoFocus?: boolean
  required?: boolean
  id?: string
  autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw-input">
      <input
        id={id}
        className="login-pin-input"
        type={show ? 'text' : 'password'}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete={autoComplete}
        maxLength={LOGIN_PIN_DIGITS}
        value={value}
        onChange={(e) =>
          onChange(e.target.value.replace(/\D/g, '').slice(0, LOGIN_PIN_DIGITS))
        }
        required={required}
        autoFocus={autoFocus}
        spellCheck={false}
        aria-label="PIN"
      />
      <button
        type="button"
        className="pw-input__toggle"
        aria-label={show ? 'Hide PIN' : 'Show PIN'}
        onClick={() => setShow((v) => !v)}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}
