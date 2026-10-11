import { describe, expect, test } from 'claude-code/testing'

import { fakeEngine, todo } from './fixtures/fake-engine'

const SESSION = { surface: 'terminal', isInteractive: true, cwd: '/work' } as const
// What the engine adds to a command typed at the prompt.
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

describe('commands and loading', () => {
  test('/todo with no text opens the pane', async ($, on) => {
    const engine = fakeEngine(on)
    await $.session.start(SESSION)

    const answer = await $.command.run({ command: 'todo', args: '', ...TYPED })

    expect(answer.text).toBe('Todo panel opened.')
    expect(engine.opened).toContain('todo')
    expect(engine.stored()).toBeUndefined()
  })

  test('/todo with text adds a todo and saves it', async ($, on) => {
    const engine = fakeEngine(on)
    await $.session.start(SESSION)

    const answer = await $.command.run({ command: 'todo', args: '  buy milk ', ...TYPED })

    expect(answer.text).toBe('Added todo: buy milk')
    expect(engine.stored()?.map(t => t.text)).toEqual(['buy milk'])
  })

  test('a session loads the saved list', async ($, on) => {
    fakeEngine(on, [todo('a1', 'milk'), todo('b2', 'eggs', true)])
    await $.session.start(SESSION)

    const { result } = await $.tool.call({ tool: 'mcp__todo__todos', action: 'list' })

    expect(result).toBe('[ ] a1  milk\n[x] b2  eggs')
  })

  test('an empty store starts with an empty list', async ($, on) => {
    fakeEngine(on)
    await $.session.start(SESSION)

    const { result } = await $.tool.call({ tool: 'mcp__todo__todos', action: 'list' })

    expect(result).toBe('The todo list is empty.')
  })
})
