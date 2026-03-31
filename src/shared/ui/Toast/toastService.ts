export type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface ToastData {
  id: string
  message: string
  type: ToastType
  duration?: number
}

export let addToastFn: ((toast: Omit<ToastData, 'id'>) => void) | null = null

export function setAddToastFn(fn: typeof addToastFn) {
  addToastFn = fn
}

export function toast(message: string, type: ToastType = 'info', duration = 4000) {
  addToastFn?.({ message, type, duration })
}
