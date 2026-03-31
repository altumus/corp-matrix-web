import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useProfile } from '../hooks/useProfile.js'
import { Avatar, Button, Input, Spinner } from '../../../shared/ui/index.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import styles from './ProfileSettings.module.scss'

export function ProfileSettings() {
  const { t } = useTranslation()
  const { profile, loading, updateDisplayName, updateAvatar } = useProfile()
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [initialized, setInitialized] = useState(false)

  if (loading) return <Spinner />

  if (profile && !initialized) {
    setDisplayName(profile.displayName)
    setInitialized(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateDisplayName(displayName)
      toast(t('settings.saved'), 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await updateAvatar(file)
      toast(t('settings.saved'), 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'error')
    }
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>{t('settings.profile')}</h3>

      <div className={styles.avatarSection}>
        <Avatar
          src={profile?.avatarUrl}
          name={profile?.displayName || '?'}
          size="xl"
        />
        <div>
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
            {t('settings.changeAvatar')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className={styles.hidden}
            onChange={handleAvatarChange}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          label={t('settings.displayName')}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <p className={styles.userId}>{profile?.userId}</p>
        <Button type="submit" loading={saving}>
          {t('settings.save')}
        </Button>
      </form>
    </div>
  )
}
