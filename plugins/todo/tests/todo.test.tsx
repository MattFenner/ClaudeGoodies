import { expect, test } from 'claude-code/testing'

import { addFieldKey, addTodo } from './fixtures/fake-engine'

const PANE = {
  component: 'Pane',
  requestId: 'todo',
  props: { title: 'Todos', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

test('the panel adds, ticks, clears and removes todos on every surface with input', async ($, on) => {
  // Stands in for the store, keeping the last list the plugin saved.
  let saved: { text: string }[] = []
  on('store.set', ($, e) => {
    if (e.key === 'todos') saved = e.value as { text: string }[]
    return { value: undefined }
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'todo', surface, ...PANE })

    // Each add gives a fresh add field (a new key), which is what clears the text that was typed.
    const fieldBefore = await addFieldKey(ui)
    await addTodo(ui, 'buy milk')
    expect(await addFieldKey(ui)).not.toBe(fieldBefore)
    // The todo's text sits beside its checkbox button, not inside it.
    expect(await ui.find({ text: /buy milk/ })).toBeDefined()
    const toggle = (await ui.findAll({ type: 'Button' })).find(b => b.key?.startsWith('toggle-'))
    expect(toggle?.text).toContain('☐')
    expect(await ui.find({ text: /1 open · 0 done/ })).toBeDefined()

    await ui.press({ key: toggle!.key! })
    expect(await ui.find({ text: /0 open · 1 done/ })).toBeDefined()

    await ui.press({ key: 'clear-done' })
    expect(await ui.find({ text: /Nothing to do/ })).toBeDefined()

    await addTodo(ui, 'write tests')
    expect(saved.map(t => t.text)).toEqual(['write tests'])

    const remove = (await ui.findAll({ type: 'Button' })).find(b => b.key?.startsWith('remove-'))
    await ui.press({ key: remove!.key! })
    expect(await ui.find({ text: /Nothing to do/ })).toBeDefined()
    expect(saved).toEqual([])
    await ui.unmount()
  }
})
