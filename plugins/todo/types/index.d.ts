export interface Todo {
	id: string;
	text: string;
	isDone: boolean;
	createdAt: string;
}

export type TodoStore = {
	load(): Promise<void>
	getAll(): Promise<Todo[]>
	getById(id?: string): Promise<Todo | undefined>
	add: (text: string) => unknown
	toggle: (id: string) => unknown
	remove: (id: string) => unknown
	clearDone: () => unknown
}


declare module 'claude-code' {
	interface PluginState {
		todo: {
			list: Todo[];
		};
	}
}
