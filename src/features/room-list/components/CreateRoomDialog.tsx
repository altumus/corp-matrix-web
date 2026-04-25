import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { useDebounce } from '../../../shared/hooks/useDebounce.js'
import { Preset } from 'matrix-js-sdk/lib/@types/partials.js'
import type { ICreateRoomOpts } from 'matrix-js-sdk/lib/@types/requests.js'
import { Modal, Input, Button, Avatar } from '../../../shared/ui/index.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import { useUserSearch, type UserResult } from '../../search/hooks/useUserSearch.js'
import styles from './CreateRoomDialog.module.scss'

interface CreateRoomDialogProps {
  onClose: () => void
}

const MXID_PATTERN = /^@[^:\s]+:[^:\s]+$/

export function CreateRoomDialog({ onClose }: CreateRoomDialogProps) {
  const { t } = useTranslation()
  const client = useMatrixClient()
  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')
  const [isDirect, setIsDirect] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null)
  const [loading, setLoading] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const { users, loading: searching, search } = useUserSearch()

  useEffect(() => {
    const term = debouncedQuery.trim()
    if (term.length >= 2) search(term)
  }, [debouncedQuery, search])

  const trimmed = query.trim()
  const looksLikeMxid = MXID_PATTERN.test(trimmed)
  const inviteId = selectedUser?.userId ?? (looksLikeMxid ? trimmed : '')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!client) return

    setLoading(true)
    try {
      const opts: ICreateRoomOpts = {
        name: isDirect ? undefined : name,
        topic: topic || undefined,
        is_direct: isDirect,
        preset: isDirect ? Preset.TrustedPrivateChat : Preset.PrivateChat,
        invite: inviteId ? [inviteId] : [],
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

        <div className={styles.userPicker}>
          <label className={styles.userPickerLabel}>{t('rooms.inviteUsers')}</label>
          {selectedUser ? (
            <div className={styles.selectedUser}>
              <Avatar src={selectedUser.avatarUrl} name={selectedUser.displayName} size="sm" />
              <div className={styles.userInfo}>
                <span className={styles.userName}>{selectedUser.displayName}</span>
                <span className={styles.userId}>{selectedUser.userId}</span>
              </div>
              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => setSelectedUser(null)}
                aria-label={t('common.cancel')}
              >
                ×
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                className={styles.search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('rooms.inviteUsersPlaceholder')}
              />
              {trimmed.length >= 2 && (
                <div className={styles.list}>
                  {users.map((user) => (
                    <button
                      key={user.userId}
                      type="button"
                      className={styles.userItem}
                      onClick={() => {
                        setSelectedUser(user)
                        setQuery('')
                      }}
                    >
                      <Avatar src={user.avatarUrl} name={user.displayName} size="sm" />
                      <div className={styles.userInfo}>
                        <span className={styles.userName}>{user.displayName}</span>
                        <span className={styles.userId}>{user.userId}</span>
                      </div>
                    </button>
                  ))}
                  {!searching && users.length === 0 && (
                    <div className={styles.empty}>
                      {looksLikeMxid
                        ? t('rooms.willInviteByMxid', { mxid: trimmed })
                        : t('search.noResults')}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

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
