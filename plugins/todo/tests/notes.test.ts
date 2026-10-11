import { describe, expect, test } from 'claude-code/testing'

import { addTodo, fakeEngine } from './fixtures/fake-engine'

const PANE = {
  component: 'Pane',
  requestId: 'todo',
  props: { title: 'Todos', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

describe('notes', () => {
  test('the chevron shows the notes as text, and clicking them edits them', async ($, on) => {
    const engine = fakeEngine(on)

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: 'todo', surface, ...PANE })
      await addTodo(ui, 'buy milk')
      const id = (await ui.findAll({ type: 'Button' })).find(b => b.key?.startsWith('toggle-'))!.key!.slice('toggle-'.length)

      // Collapsed: the chevron points right and no notes are drawn.
      expect((await ui.find({ key: `expand-${id}` }))?.text).toContain('▸')
      expect(await ui.find({ key: `notes-text-${id}` })).toBeUndefined()

      // Expanded: the notes are text (here, a prompt to add some), not a field.
      await ui.press({ key: `expand-${id}` })
      expect((await ui.find({ key: `expand-${id}` }))?.text).toContain('▾')
      expect((await ui.find({ key: `notes-text-${id}` }))?.text).toContain('Add notes')
      expect(await ui.find({ key: `notes-${id}` })).toBeUndefined()

      // Clicking them opens the field, with a cancel that puts the text back.
      await ui.press({ key: `notes-text-${id}` })
      expect(await ui.find({ key: `notes-${id}` })).toBeDefined()
      await ui.press({ key: `cancel-notes-${id}` })
      expect(await ui.find({ key: `notes-${id}` })).toBeUndefined()
      expect(engine.stored()?.[0]).not.toHaveProperty('notes')

      // Saving from the field stores the notes and shows them as text again.
      await ui.press({ key: `notes-text-${id}` })
      await ui.input({ key: `notes-${id}`, text: 'two litres, semi-skimmed' })
      expect(engine.stored()?.[0]?.notes).toBe('two litres, semi-skimmed')
      expect(await ui.find({ key: `notes-${id}` })).toBeUndefined()
      expect((await ui.find({ key: `notes-text-${id}` }))?.text).toContain('two litres, semi-skimmed')

      // Collapsing hides them.
      await ui.press({ key: `expand-${id}` })
      expect(await ui.find({ key: `notes-text-${id}` })).toBeUndefined()

      // Saving empty notes clears them.
      await ui.press({ key: `expand-${id}` })
      await ui.press({ key: `notes-text-${id}` })
      await ui.input({ key: `notes-${id}`, text: '' })
      expect(engine.stored()?.[0]).not.toHaveProperty('notes')
      expect((await ui.find({ key: `notes-text-${id}` }))?.text).toContain('Add notes')

      await ui.press({ key: `remove-${id}` })
      await ui.unmount()
    }
  })

  test('only one thing is edited at a time', async ($, on) => {
    fakeEngine(on)

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: 'todo', surface, ...PANE })
      await addTodo(ui, 'buy milk')
      const id = (await ui.findAll({ type: 'Button' })).find(b => b.key?.startsWith('toggle-'))!.key!.slice('toggle-'.length)
      await ui.press({ key: `expand-${id}` })

      await ui.press({ key: `title-${id}` })
      expect(await ui.find({ key: `edit-${id}` })).toBeDefined()

      // Starting to edit the notes ends the title edit.
      await ui.press({ key: `notes-text-${id}` })
      expect(await ui.find({ key: `notes-${id}` })).toBeDefined()
      expect(await ui.find({ key: `edit-${id}` })).toBeUndefined()

      await ui.press({ key: `remove-${id}` })
      await ui.unmount()
    }
  })

  test('clicking a title edits it in place, and does not expand the notes', async ($, on) => {
    const engine = fakeEngine(on)

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: 'todo', surface, ...PANE })
      await addTodo(ui, 'buy milk')
      const id = (await ui.findAll({ type: 'Button' })).find(b => b.key?.startsWith('toggle-'))!.key!.slice('toggle-'.length)

      // Click the title: a field with the title appears, and the notes stay hidden.
      await ui.press({ key: `title-${id}` })
      expect(await ui.find({ key: `edit-${id}` })).toBeDefined()
      expect(await ui.find({ key: `notes-${id}` })).toBeUndefined()

      // Cancel puts the title back unchanged.
      await ui.press({ key: `cancel-${id}` })
      expect(await ui.find({ key: `edit-${id}` })).toBeUndefined()
      expect(engine.stored()?.[0]?.text).toBe('buy milk')

      // Saving a new title changes it and leaves editing.
      await ui.press({ key: `title-${id}` })
      await ui.input({ key: `edit-${id}`, text: '  buy oat milk ' })
      expect(engine.stored()?.[0]?.text).toBe('buy oat milk')
      expect(await ui.find({ key: `edit-${id}` })).toBeUndefined()
      expect(await ui.find({ text: /buy oat milk/ })).toBeDefined()

      // An empty title is ignored: the old one stays.
      await ui.press({ key: `title-${id}` })
      await ui.input({ key: `edit-${id}`, text: '   ' })
      expect(engine.stored()?.[0]?.text).toBe('buy oat milk')
      expect(await ui.find({ key: `edit-${id}` })).toBeUndefined()

      await ui.press({ key: `remove-${id}` })
      await ui.unmount()
    }
  })
})
