const AudioContext = window.AudioContext || (window as never as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext

let ringAudioCtx: AudioContext | null = null
let ringOscillator: OscillatorNode | null = null
let ringGain: GainNode | null = null
let ringInterval: ReturnType<typeof setInterval> | null = null

function getAudioContext(): AudioContext {
  if (!ringAudioCtx || ringAudioCtx.state === 'closed') {
    ringAudioCtx = new AudioContext()
  }
  return ringAudioCtx
}

/**
 * Play a repeating two-tone ringtone for incoming calls.
 * Pattern: 440Hz 200ms → 480Hz 200ms → silence 1600ms (repeat)
 */
export function playIncomingRingtone(): void {
  stopRingtone()

  const ctx = getAudioContext()
  if (ctx.state === 'suspended') ctx.resume()

  const playBurst = () => {
    try {
      // First tone
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.frequency.value = 440
      osc1.type = 'sine'
      gain1.gain.value = 0.15
      osc1.connect(gain1).connect(ctx.destination)
      osc1.start(ctx.currentTime)
      osc1.stop(ctx.currentTime + 0.2)

      // Second tone
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.frequency.value = 480
      osc2.type = 'sine'
      gain2.gain.value = 0.15
      osc2.connect(gain2).connect(ctx.destination)
      osc2.start(ctx.currentTime + 0.25)
      osc2.stop(ctx.currentTime + 0.45)
    } catch { /* audio context may be unavailable */ }
  }

  playBurst()
  ringInterval = setInterval(playBurst, 2000)
}

/**
 * Play a repeating single-tone ringback for outgoing calls.
 * Pattern: 425Hz 1000ms → silence 4000ms (repeat)
 */
export function playOutgoingRingback(): void {
  stopRingtone()

  const ctx = getAudioContext()
  if (ctx.state === 'suspended') ctx.resume()

  const playBurst = () => {
    try {
      ringOscillator = ctx.createOscillator()
      ringGain = ctx.createGain()
      ringOscillator.frequency.value = 425
      ringOscillator.type = 'sine'
      ringGain.gain.value = 0.1
      ringOscillator.connect(ringGain).connect(ctx.destination)
      ringOscillator.start(ctx.currentTime)
      ringOscillator.stop(ctx.currentTime + 1)
    } catch { /* audio context may be unavailable */ }
  }

  playBurst()
  ringInterval = setInterval(playBurst, 5000)
}

export function stopRingtone(): void {
  if (ringInterval) {
    clearInterval(ringInterval)
    ringInterval = null
  }
  try { ringOscillator?.stop() } catch { /* already stopped */ }
  ringOscillator = null
  ringGain = null
}
