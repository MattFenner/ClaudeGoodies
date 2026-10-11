import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  component: 'Pane',
  requestId: 'todo-list',
  props: { title: 'Todos', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

test('the panel adds, ticks, clears and removes todos on every surface with input', async ($, on) => {
  mock.env(on, { CLAUDE_PLUGIN_DATA: 'C:/plugin-data/todo-list' })
  // An in-memory file system standing in for the data folder.
  const files = new Map<string, string>()
  on('fs.write', ($, e) => {
    files.set(e.path, e.text)
    return { value: undefined }
  })
  on('fs.read', ($, e) => {
    const text = files.get(e.path)
    if (text === undefined) throw new Error('missing')
    return { value: text }
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'todo-list', surface, ...PANE })

    await ui.input({ key: 'new', text: 'buy milk' })
    const toggle = await ui.find({ text: /buy milk/, type: 'Button' })
    expect(toggle?.text).toContain('☐')
    expect(await ui.find({ text: /1 open · 0 done/ })).toBeDefined()

    await ui.press({ key: toggle!.key! })
    expect(await ui.find({ text: /0 open · 1 done/ })).toBeDefined()

    await ui.press({ key: 'clear-done' })
    expect(await ui.find({ text: /Nothing to do/ })).toBeDefined()

    await ui.input({ key: 'new', text: 'write tests' })
    const remove = (await ui.findAll({ type: 'Button' })).find(b => b.key?.startsWith('remove-'))
    await ui.press({ key: remove!.key! })
    expect(await ui.find({ text: /Nothing to do/ })).toBeDefined()
    await ui.unmount()
  }
  expect([...files.keys()]).toEqual(['C:\\plugin-data\\todo-list\\todos.json'])
})
