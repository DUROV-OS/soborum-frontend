const key = (userId: number) => 'soborbum.inquiry-sound.' + userId

export function soundPreference(userId: number): boolean {
  return read(key(userId)) !== 'off'
}

export function saveSoundPreference(userId: number, enabled: boolean) {
  write(key(userId), enabled ? 'on' : 'off')
}

function read(name: string) {
  try {
    return localStorage.getItem(name)
  } catch {
    return null
  }
}

function write(name: string, value: string) {
  try {
    localStorage.setItem(name, value)
  } catch {
    // Browser storage is optional. Sound still works in the current tab.
  }
}

function play(context: AudioContext) {
  for (const [frequency, offset] of [[660, 0], [880, 0.135]]) {
    const start = context.currentTime + offset
    const oscillator = context.createOscillator()
    const volume = context.createGain()
    oscillator.frequency.value = frequency
    volume.gain.setValueAtTime(0.001, start)
    volume.gain.exponentialRampToValueAtTime(0.12, start + 0.025)
    volume.gain.exponentialRampToValueAtTime(0.001, start + 0.13)
    oscillator.connect(volume).connect(context.destination)
    oscillator.onended = () => {
      oscillator.disconnect()
      volume.disconnect()
    }
    oscillator.start(start)
    oscillator.stop(start + 0.14)
  }
}

export function ringForInquiries(context: AudioContext, userId: number, ids: number[]) {
  const playedKey = key(userId) + '.played'
  const ring = () => {
    if (context.state !== 'running' || !soundPreference(userId)) return
    const played = (read(playedKey) || '').split(',').filter(Boolean)
    const newIds = ids.map(String).filter(id => !played.includes(id))
    if (!newIds.length) return
    play(context)
    write(playedKey, [...played, ...newIds].slice(-50).join(','))
  }
  // A manager may have the same workspace open in several tabs.
  if (navigator.locks) void navigator.locks.request(playedKey, ring).catch(() => {})
  else ring()
}
