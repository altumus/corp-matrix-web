import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { Preset } from 'matrix-js-sdk/lib/@types/partials.js'
import { Modal, Input, Button } from '../../../shared/ui/index.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'

interface CreateSpaceDialogProps {
  onClose: () => void
}

export function CreateSpaceDialog({ onClose }: CreateSpaceDialogProps) {
  const { t } = useTranslation()
  const client = useMatrixClient()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!client || !name.trim()) return

    setLoading(true)
    try {
      await client.createRoom({
        name,
        preset: Preset.PrivateChat,
        creation_content: { type: 'm.space' },
        power_level_content_override: { events_default: 0 },
      })
      toast(t('spaces.create'), 'success')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('spaces.create')}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Input
          label={t('rooms.roomName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button variant="secondary" onClick={onClose} type="button">
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={loading}>
            {t('spaces.create')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
