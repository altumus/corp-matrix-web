import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../shared/i18n/index.js'
import { ToastContainer } from '../shared/ui/index.js'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <I18nextProvider i18n={i18n}>
      {children}
      <ToastContainer />
    </I18nextProvider>
  )
}
