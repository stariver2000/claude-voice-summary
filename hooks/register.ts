import type { EngineInterface, Register } from 'claude-code'

type Config = { enabled: boolean; voice: string; speed: number }

const DEFAULTS: Config = { enabled: true, voice: 'af_heart', speed: 1.05 }
const MARKER = '🔊'
const SAMPLE = 'Hi, this is how I will sound when I read your English summaries.'

// Kokoro v1.0 English voices, grouped by the two-letter prefix (accent, then gender).
const VOICE_GROUPS: readonly { label: string; voices: readonly string[] }[] = [
  { label: 'American  female', voices: ['af_heart', 'af_bella', 'af_nicole', 'af_sarah', 'af_sky', 'af_nova'] },
  { label: 'American  male', voices: ['am_michael', 'am_adam', 'am_eric', 'am_liam', 'am_onyx'] },
  { label: 'British   female', voices: ['bf_emma', 'bf_isabella', 'bf_alice'] },
  { label: 'British   male', voices: ['bm_george', 'bm_lewis', 'bm_daniel'] },
]
const VOICES = VOICE_GROUPS.flatMap(group => group.voices)

// Accepts `am_michael`, `am michael`, `AM-Michael` or just `michael` (when one voice has that name).
function resolveVoice(words: readonly string[]): string | undefined {
  const typed = words.join('_').toLowerCase().replace(/[-\s]+/g, '_')
  if (VOICES.includes(typed)) return typed
  const byName = VOICES.filter(voice => voice.slice(3) === typed)
  return byName.length === 1 ? byName[0] : undefined
}

function voiceList(current: string): string {
  const rows = VOICE_GROUPS.map(({ label, voices }) => {
    const names = voices.map(name => (name === current ? `[${name}]` : name).padEnd(13)).join('')
    return `  ${label.padEnd(18)}${names.trimEnd()}`
  })
  return [
    `Voices  (current: ${current})`,
    '',
    ...rows,
    '',
    'Change:  /voice voice <name>    e.g. /voice voice am_michael  (or just: /voice voice michael)',
  ].join('\n')
}

const SECTION = [
  `At the very end of every reply to the person, add a heading "### ${MARKER} English"`,
  'followed by a two- or three-sentence summary of that reply in plain, easy English.',
  'Write only natural spoken sentences there: no code, paths, tables, lists or markdown symbols.',
  `Use the ${MARKER} symbol nowhere else in the reply.`,
  'The section is read aloud to the person for English listening practice.',
].join(' ')

const USAGE = [
  '/voice                 show the current settings',
  '/voice on | off        turn the spoken summary on or off',
  '/voice voice <name>    pick a voice (see /voice list)',
  '/voice speed <0.5-2>   set the speaking speed (1.0 is normal)',
  '/voice list            list the voices',
  '/voice test            hear the current voice',
  '/voice setup           install Kokoro and download the model (~350 MB, once)',
].join('\n')

async function loadConfig($: EngineInterface): Promise<Config> {
  const stored = (await $.store.get('config')) as Partial<Config> | undefined
  return { ...DEFAULTS, ...stored }
}

async function saveConfig($: EngineInterface, patch: Partial<Config>): Promise<Config> {
  const config = { ...(await loadConfig($)), ...patch }
  await $.store.set('config', config)
  return config
}

async function dataDir($: EngineInterface): Promise<string> {
  return (await $.env.get('CLAUDE_VOICE_HOME')) ?? `${await $.env.get('HOME')}/.local/share/claude-voice`
}

function englishSection(answer: string): string {
  const lines = answer.split('\n')
  const at = lines.map(line => line.includes(MARKER)).lastIndexOf(true)
  if (at < 0) return ''
  return lines
    .slice(at + 1)
    .join('\n')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_#>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function speak($: EngineInterface, text: string, config: Config): Promise<string | undefined> {
  const python = `${await dataDir($)}/venv/bin/python`
  if (!(await $.fs.exists(python))) return 'Kokoro is not installed yet. Run /voice setup once.'
  const { exitCode, stderr } = await $.process.run(
    [python, `${$.plugin.root}/scripts/speak.py`, '--voice', config.voice, '--speed', String(config.speed)],
    { stdin: text, timeoutMs: 10_000 },
  )
  return exitCode === 0 ? undefined : `Could not speak: ${stderr.trim().split('\n').pop()}`
}

function describe(config: Config): string {
  return `Voice summary is ${config.enabled ? 'on' : 'off'} · voice ${config.voice} · speed ${config.speed}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'voice',
      description: 'Spoken English summary: on/off, voice, speed, test, setup',
      argumentHint: 'on|off|voice <name>|speed <n>|list|test|setup',
    })
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (!(await loadConfig($)).enabled) return composed
    return {
      sections: [...composed.sections, { id: 'voice-summary:english', text: SECTION, scope: 'session' as const }],
    }
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined || e.reason !== 'answer') return result
    const config = await loadConfig($)
    const text = config.enabled ? englishSection(e.answer) : ''
    if (text) {
      const problem = await speak($, text, config)
      if (problem) $.ui.toast(problem)
    }
    return result
  })

  on('command.run', { command: 'voice' }, async ($, e) => {
    const [action = '', ...rest] = e.args.trim().split(/\s+/)
    const value = rest[0] ?? ''
    const config = await loadConfig($)

    switch (action) {
      case '':
      case 'status':
        return { text: `${describe(config)}\n\n${USAGE}` }
      case 'on':
      case 'off':
        return { text: describe(await saveConfig($, { enabled: action === 'on' })) }
      case 'list':
        return { text: voiceList(config.voice) }
      case 'voice': {
        const voice = resolveVoice(rest)
        if (!voice) return { text: `Unknown voice "${rest.join(' ')}".\n\n${voiceList(config.voice)}` }
        const updated = await saveConfig($, { voice })
        return { text: (await speak($, SAMPLE, updated)) ?? describe(updated) }
      }
      case 'speed': {
        const speed = Number(value)
        if (!Number.isFinite(speed) || speed < 0.5 || speed > 2) return { text: 'Speed must be a number from 0.5 to 2 (1.0 is normal).' }
        const updated = await saveConfig($, { speed })
        return { text: (await speak($, SAMPLE, updated)) ?? describe(updated) }
      }
      case 'test':
        return { text: (await speak($, SAMPLE, config)) ?? describe(config) }
      case 'setup': {
        const { exitCode, stdout, stderr } = await $.process.run(['bash', `${$.plugin.root}/scripts/setup.sh`], {
          timeoutMs: 600_000,
        })
        if (exitCode !== 0) return { text: `Setup failed:\n${stderr.trim()}` }
        return { text: `${stdout.trim()}\n${(await speak($, SAMPLE, config)) ?? describe(config)}` }
      }
      default:
        return { text: USAGE }
    }
  })
}
