import { useTranslation } from 'react-i18next'
import { Input } from '../../../shared/ui/index.js'

interface ServerPickerProps {
  value: string
  onChange: (value: string) => void
  error?: string
}

export function ServerPicker({ value, onChange, error }: ServerPickerProps) {
  const { t } = useTranslation()

  return (
    <Input
      label={t('auth.homeserver')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t('auth.homeserverPlaceholder')}
      error={error}
      autoComplete="url"
    />
  )
}
