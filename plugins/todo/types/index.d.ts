export interface Todo {
	id: string;
	// The title.
	text: string;
	// Longer notes, shown when the todo is expanded. Absent when there are none.
	notes?: string;
	isDone: boolean;
	createdAt: string;
}

export type TodoStore = {
	load(): Promise<void>
	getAll(): Promise<Todo[]>
	getById(id?: string): Promise<Todo | undefined>
	// The ids of the todos shown expanded.
	getExpanded(): Promise<string[]>
	toggleExpanded: (id: string) => unknown
	// What is being edited: 'title:<id>' or 'notes:<id>' for that todo's field, or '' when nothing is.
	getEditing(): Promise<string>
	setEditing: (target: string) => unknown
	// Saves a new title (an empty one is ignored) and stops editing.
	setText: (id: string, text: string) => unknown
	// How many todos have been added this session. The add field is keyed by it, so that each add
	// gives a fresh, empty field.
	getAddCount(): Promise<number>
	add: (text: string, notes?: string) => unknown
	// An empty string clears the notes. Stops editing.
	setNotes: (id: string, notes: string) => unknown
	toggle: (id: string) => unknown
	remove: (id: string) => unknown
	clearDone: () => unknown
}


declare module 'claude-code' {
	interface PluginState {
		todo: {
			list: Todo[];
			expanded: string[];
			editing: string;
			added: number;
		};
	}
}
