import { describe, expect, test } from 'claude-code/testing'

import { fakeEngine, todo } from './fixtures/fake-engine'

const SESSION = { surface: 'terminal', isInteractive: true, cwd: '/work' } as const
const TOOL = 'mcp__todo__todos'

describe('todos tool', () => {
  test('add saves a new todo', async ($, on) => {
    const engine = fakeEngine(on)
    await $.session.start(SESSION)

    const { result } = await $.tool.call({ tool: TOOL, action: 'add', text: ' write tests ' })

    expect(engine.stored()?.map(t => t.text)).toEqual(['write tests'])
    expect(result).toContain('write tests')
  })

  test('complete and reopen change a todo and save it', async ($, on) => {
    const engine = fakeEngine(on, [todo('a1', 'milk')])
    await $.session.start(SESSION)

    await $.tool.call({ tool: TOOL, action: 'complete', id: 'a1' })
    expect(engine.stored()?.[0]?.isDone).toBe(true)

    await $.tool.call({ tool: TOOL, action: 'reopen', id: 'a1' })
    expect(engine.stored()?.[0]?.isDone).toBe(false)
  })

  test('completing a finished todo leaves it finished', async ($, on) => {
    const engine = fakeEngine(on, [todo('a1', 'milk', true)])
    await $.session.start(SESSION)

    await $.tool.call({ tool: TOOL, action: 'complete', id: 'a1' })

    expect(engine.stored()?.[0]?.isDone).toBe(true)
  })

  test('remove deletes one todo', async ($, on) => {
    const engine = fakeEngine(on, [todo('a1', 'milk'), todo('b2', 'eggs')])
    await $.session.start(SESSION)

    await $.tool.call({ tool: TOOL, action: 'remove', id: 'a1' })

    expect(engine.stored()?.map(t => t.id)).toEqual(['b2'])
  })

  test('clear_done removes finished todos only', async ($, on) => {
    const engine = fakeEngine(on, [todo('a1', 'milk', true), todo('b2', 'eggs')])
    await $.session.start(SESSION)

    await $.tool.call({ tool: TOOL, action: 'clear_done' })

    expect(engine.stored()?.map(t => t.id)).toEqual(['b2'])
  })

  test('add takes notes, and list shows them under the title', async ($, on) => {
    const engine = fakeEngine(on)
    await $.session.start(SESSION)

    await $.tool.call({ tool: TOOL, action: 'add', text: 'milk', notes: ' two litres\nsemi-skimmed ' })
    const { result } = await $.tool.call({ tool: TOOL, action: 'list' })

    expect(engine.stored()?.[0]?.notes).toBe('two litres\nsemi-skimmed')
    expect(result).toMatch(/\[ \] \w+ {2}milk\n {6}two litres\n {6}semi-skimmed$/)
  })

  test('set_notes changes a todo\'s notes, and empty notes clear them', async ($, on) => {
    const engine = fakeEngine(on, [todo('a1', 'milk')])
    await $.session.start(SESSION)

    await $.tool.call({ tool: TOOL, action: 'set_notes', id: 'a1', notes: 'two litres' })
    expect(engine.stored()?.[0]?.notes).toBe('two litres')

    await $.tool.call({ tool: TOOL, action: 'set_notes', id: 'a1', notes: '' })
    expect(engine.stored()?.[0]).not.toHaveProperty('notes')
  })

  test('bad input is refused as an error and changes nothing', async ($, on) => {
    const engine = fakeEngine(on, [todo('a1', 'milk')])
    await $.session.start(SESSION)
    const before = engine.stored()

    const noText = await $.tool.call({ tool: TOOL, action: 'add', text: '   ' })
    const noSuchId = await $.tool.call({ tool: TOOL, action: 'remove', id: 'zzz' })
    const notesForNoSuchId = await $.tool.call({ tool: TOOL, action: 'set_notes', id: 'zzz', notes: 'x' })
    const noAction = await $.tool.call({ tool: TOOL, action: 'explode' })

    for (const refused of [noText, noSuchId, notesForNoSuchId, noAction]) expect(refused.isError).toBe(true)
    expect(engine.stored()).toEqual(before)
  })
})
