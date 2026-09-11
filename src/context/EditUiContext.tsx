import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { canDevelop } from '../lib/authAllowlist'

const KEY = 'nasta-edit-ui-v1'

interface EditUiContextValue {
  /** Developer-only; pens visible when true. */
  editUi: boolean
  setEditUi: (on: boolean) => void
  toggleEditUi: () => void
  canEditUi: boolean
}

const EditUiContext = createContext<EditUiContextValue | null>(null)

export function EditUiProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const canEditUi = canDevelop(user)
  const [editUi, setEditUiState] = useState(() => {
    try {
      return sessionStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })

  const setEditUi = useCallback(
    (on: boolean) => {
      if (!canEditUi) {
        setEditUiState(false)
        return
      }
      setEditUiState(on)
      try {
        sessionStorage.setItem(KEY, on ? '1' : '0')
      } catch {
        /* ignore */
      }
    },
    [canEditUi],
  )

  const toggleEditUi = useCallback(() => setEditUi(!editUi), [editUi, setEditUi])

  const value = useMemo(
    () => ({
      editUi: canEditUi && editUi,
      setEditUi,
      toggleEditUi,
      canEditUi,
    }),
    [canEditUi, editUi, setEditUi, toggleEditUi],
  )

  return <EditUiContext.Provider value={value}>{children}</EditUiContext.Provider>
}

export function useEditUi() {
  const ctx = useContext(EditUiContext)
  if (!ctx) {
    return {
      editUi: false,
      setEditUi: () => undefined,
      toggleEditUi: () => undefined,
      canEditUi: false,
    } satisfies EditUiContextValue
  }
  return ctx
}
