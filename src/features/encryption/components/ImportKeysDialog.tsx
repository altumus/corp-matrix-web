import { useState, useRef } from 'react'
import { Upload } from 'lucide-react'
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          Загрузите файл с ключами, экспортированный из Element или FluffyChat.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.txt"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <Input
          label="Пароль (если файл зашифрован)"
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Оставьте пустым если без пароля"
        />
        <Button onClick={handleImport} disabled={!file || loading} loading={loading}>
          <Upload size={16} /> Импортировать
        </Button>
      </div>
    </Modal>
  )
}
