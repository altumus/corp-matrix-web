import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { Modal, Input, Button } from '../../../shared/ui/index.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import styles from './CreatePollDialog.module.scss'

interface CreatePollDialogProps {
  roomId: string
  onClose: () => void
}

export function CreatePollDialog({ roomId, onClose }: CreatePollDialogProps) {
  const { t } = useTranslation()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [disclosed, setDisclosed] = useState(true)
  const [multiSelect, setMultiSelect] = useState(false)
  const [loading, setLoading] = useState(false)

  const addOption = () => setOptions([...options, ''])

  const removeOption = (index: number) => {
    if (options.length <= 2) return
    setOptions(options.filter((_, i) => i !== index))
  }

  const updateOption = (index: number, value: string) => {
    const next = [...options]
    next[index] = value
    setOptions(next)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const client = getMatrixClient()
    if (!client) return

    const validOptions = options.filter((o) => o.trim())
    if (!question.trim() || validOptions.length < 2) return

    setLoading(true)
    try {
      const answers = validOptions.map((text, i) => ({
        id: `opt-${i}-${Date.now()}`,
        'org.matrix.msc1767.text': text.trim(),
      }))

      const kind = disclosed
        ? 'org.matrix.msc3381.poll.disclosed'
        : 'org.matrix.msc3381.poll.undisclosed'

      const pollData = {
        kind,
        max_selections: multiSelect ? validOptions.length : 1,
        question: { 'org.matrix.msc1767.text': question.trim() },
        answers,
      }

      const fallbackText = `${question.trim()}\n${validOptions.map((o, i) => `${i + 1}. ${o}`).join('\n')}`

      await client.sendEvent(roomId, 'org.matrix.msc3381.poll.start' as never, {
        'org.matrix.msc3381.poll': pollData,
        'org.matrix.msc1767.text': fallbackText,
      } as never)

      toast(t('messages.createPoll'), 'success')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('messages.createPoll')}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          label={t('messages.pollQuestion')}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
          autoFocus
        />

        <div className={styles.options}>
          {options.map((option, i) => (
            <div key={i} className={styles.optionRow}>
              <input
                className={styles.optionInput}
                value={option}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`${t('messages.pollOption')} ${i + 1}`}
              />
              {options.length > 2 && (
                <button type="button" className={styles.removeBtn} onClick={() => removeOption(i)}>
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        <button type="button" className={styles.addBtn} onClick={addOption}>
          <Plus size={16} />
          {t('messages.addOption')}
        </button>

        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={disclosed}
            onChange={(e) => setDisclosed(e.target.checked)}
          />
          <span>Ответы видны</span>
        </label>

        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={multiSelect}
            onChange={(e) => setMultiSelect(e.target.checked)}
          />
          <span>Разрешить несколько ответов</span>
        </label>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose} type="button">
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={!question.trim() || options.filter((o) => o.trim()).length < 2}
          >
            {t('messages.createPoll')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
