import { useState, useRef } from 'react'
import { Upload, FileUp } from 'lucide-react'
import { Modal, Input, Button } from '../../../shared/ui/index.js'
import { importRoomKeysFromFile } from '../services/cryptoService.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'

interface ImportKeysDialogProps {
  onClose: () => void
}

export function ImportKeysDialog({ onClose }: ImportKeysDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    try {
      const count = await importRoomKeysFromFile(file, passphrase)
      toast(`Импортировано ${count} ключей`, 'success')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка импорта', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Импорт ключей шифрования">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', padding: 'var(--spacing-lg)', maxWidth: 400 }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
          Загрузите файл с ключами, экспортированный из Element или FluffyChat.
        </p>

        {/* Hidden file input + styled button */}
        <input
          ref={fileRef}
          type="file"
          accept=".json,.txt"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-md)',
            border: '2px dashed var(--color-border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg-secondary)',
            color: file ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)',
            transition: 'all var(--transition-fast)',
          }}
        >
          <FileUp size={18} />
          {file ? file.name : 'Выбрать файл ключей...'}
        </button>

        {/* Disable browser autofill with autoComplete="new-password" + hidden username */}
        <input type="text" name="prevent_autofill" style={{ display: 'none' }} tabIndex={-1} autoComplete="username" />
        <Input
          label="Пароль (если файл зашифрован)"
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Оставьте пустым если без пароля"
          autoComplete="new-password"
        />

        <Button onClick={handleImport} disabled={!file || loading} loading={loading}>
          <Upload size={16} /> Импортировать
        </Button>
      </div>
    </Modal>
  )
}
