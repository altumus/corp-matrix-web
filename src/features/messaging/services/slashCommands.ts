/**
 * Slash command processor.
 * Returns transformed body if a command was applied, or null if not a command.
 */

export interface SlashCommandResult {
  body: string
  emote?: boolean
}

export function processSlashCommand(text: string): SlashCommandResult | null {
  if (!text.startsWith('/')) return null

  const trimmed = text.trim()
  const spaceIdx = trimmed.indexOf(' ')
  const cmd = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toLowerCase()
  const arg = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1)

  switch (cmd) {
    case '/me':
      if (!arg) return null
      return { body: arg, emote: true }
    case '/shrug':
      return { body: `${arg} ¯\\_(ツ)_/¯`.trim() }
    case '/tableflip':
      return { body: `${arg} (╯°□°)╯︵ ┻━┻`.trim() }
    case '/unflip':
      return { body: `${arg} ┬─┬ ノ( ゜-゜ノ)`.trim() }
    case '/lenny':
      return { body: `${arg} ( ͡° ͜ʖ ͡°)`.trim() }
    case '/plain':
      return { body: arg }
    default:
      return null
  }
}

export const SLASH_COMMANDS = [
  { cmd: '/me', desc: 'Действие от вашего имени' },
  { cmd: '/shrug', desc: '¯\\_(ツ)_/¯' },
  { cmd: '/tableflip', desc: '(╯°□°)╯︵ ┻━┻' },
  { cmd: '/unflip', desc: '┬─┬ ノ( ゜-゜ノ)' },
  { cmd: '/lenny', desc: '( ͡° ͜ʖ ͡°)' },
  { cmd: '/plain', desc: 'Отправить без markdown' },
]
