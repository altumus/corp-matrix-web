import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { Preset } from 'matrix-js-sdk/lib/@types/partials.js'
import type { ICreateRoomOpts } from 'matrix-js-sdk/lib/@types/requests.js'
import { Modal, Input, Button } from '../../../shared/ui/index.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import styles from './CreateRoomDialog.module.scss'

interface CreateRoomDialogProps {
  onClose: () => void
}

export function CreateRoomDialog({ onClose }: CreateRoomDialogProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')
  const [isDirect, setIsDirect] = useState(false)
  const [inviteUserId, setInviteUserId] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const client = getMatrixClient()
    if (!client) return

    setLoading(true)
    try {
      const opts: ICreateRoomOpts = {
        name: isDirect ? undefined : name,
        topic: topic || undefined,
        is_direct: isDirect,
        preset: isDirect ? Preset.TrustedPrivateChat : Preset.PrivateChat,
        invite: inviteUserId ? [inviteUserId.trim()] : [],
      }

      await client.createRoom(opts)
      toast(t('rooms.createRoom'), 'success')
      onClose()
    } catch (err) {
      toast(
        err instanceof Error ? err.message : t('common.error'),
        'error',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('rooms.create')}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${!isDirect ? styles.active : ''}`}
            onClick={() => setIsDirect(false)}
          >
            {t('rooms.createRoom')}
          </button>
          <button
            type="button"
            className={`${styles.tab} ${isDirect ? styles.active : ''}`}
            onClick={() => setIsDirect(true)}
          >
            {t('rooms.createDM')}
          </button>
        </div>

        {!isDirect && (
          <>
            <Input
              label={t('rooms.roomName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label={t('rooms.roomTopic')}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </>
        )}

        <Input
          label={t('rooms.inviteUsers')}
          value={inviteUserId}
          onChange={(e) => setInviteUserId(e.target.value)}
          placeholder="@user:server.com"
        />

        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose} type="button">
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={loading}>
            {t('rooms.create')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
