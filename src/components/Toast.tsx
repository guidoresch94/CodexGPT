import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastItem {
  text: string
  action?: { label: string; run: () => void }
}

const Ctx = createContext<(t: ToastItem) => void>(() => {})

export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((t: ToastItem) => {
    window.clearTimeout(timer.current)
    setToast(t)
    timer.current = window.setTimeout(() => setToast(null), 3500)
  }, [])

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl ring-1 ring-white/10 dark:bg-slate-100 dark:text-slate-900">
            <span>{toast.text}</span>
            {toast.action && (
              <button
                className="font-semibold text-emerald-400 dark:text-emerald-600"
                onClick={() => {
                  toast.action!.run()
                  setToast(null)
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
