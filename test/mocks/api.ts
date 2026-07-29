// Configurable mock of the Joplin plugin API default export (`import joplin from 'api'`).
//
// All methods are jest.fn()s so individual tests can override return values, e.g.:
//   import joplin from 'api';
//   (joplin.data.userDataGet as jest.Mock).mockResolvedValue({ ... });
//
// Typed loosely as `any` to keep it ergonomic in tests.

// A Disposable as returned by the various on* event registration functions.
const makeDisposable = () => ({ dispose: jest.fn() });

const joplin: any = {
	data: {
		get: jest.fn(async () => ({ items: [], has_more: false })),
		post: jest.fn(async () => ({ id: 'new-id' })),
		put: jest.fn(async () => undefined),
		delete: jest.fn(async () => undefined),
		userDataGet: jest.fn(async () => undefined),
		userDataSet: jest.fn(async () => undefined),
		userDataDelete: jest.fn(async () => undefined),
	},
	settings: {
		// Returns false by default so e.g. the @Trace() "debug enabled" check is off.
		value: jest.fn(async () => false),
		setValue: jest.fn(async () => undefined),
		onChange: jest.fn(),
		registerSection: jest.fn(),
		registerSettings: jest.fn(),
	},
	workspace: {
		selectedNote: jest.fn(async () => undefined),
		onNoteSelectionChange: jest.fn(() => makeDisposable()),
		onNoteChange: jest.fn(() => makeDisposable()),
		onNoteAlarmTrigger: jest.fn(() => makeDisposable()),
		onSyncComplete: jest.fn(() => makeDisposable()),
	},
	commands: {
		register: jest.fn(),
		execute: jest.fn(async () => undefined),
	},
	views: {
		dialogs: {
			create: jest.fn(async () => 'dialog-handle'),
			setHtml: jest.fn(async () => undefined),
			addScript: jest.fn(async () => undefined),
			open: jest.fn(async () => ({ id: 'ok' })),
			showMessageBox: jest.fn(async () => 0),
		},
		menus: {
			create: jest.fn(async () => undefined),
		},
		toolbarButtons: {
			create: jest.fn(async () => undefined),
		},
		panels: {},
	},
	plugins: {
		register: jest.fn(),
	},
};

/**
 * Resets all jest.fn mocks on the joplin mock and restores their default
 * implementations / return values. Call this in beforeEach if a test needs a
 * fully clean slate (jest's `clearMocks: true` already clears call data between
 * tests, but this also re-applies default return values overridden via
 * mockResolvedValue/mockReturnValue).
 */
export function resetJoplinMock(): void {
	joplin.data.get.mockReset();
	joplin.data.get.mockImplementation(async () => ({ items: [], has_more: false }));
	joplin.data.post.mockReset();
	joplin.data.post.mockImplementation(async () => ({ id: 'new-id' }));
	joplin.data.put.mockReset();
	joplin.data.put.mockImplementation(async () => undefined);
	joplin.data.delete.mockReset();
	joplin.data.delete.mockImplementation(async () => undefined);
	joplin.data.userDataGet.mockReset();
	joplin.data.userDataGet.mockImplementation(async () => undefined);
	joplin.data.userDataSet.mockReset();
	joplin.data.userDataSet.mockImplementation(async () => undefined);
	joplin.data.userDataDelete.mockReset();
	joplin.data.userDataDelete.mockImplementation(async () => undefined);

	joplin.settings.value.mockReset();
	joplin.settings.value.mockImplementation(async () => false);
	joplin.settings.setValue.mockReset();
	joplin.settings.setValue.mockImplementation(async () => undefined);
	joplin.settings.onChange.mockReset();
	joplin.settings.registerSection.mockReset();
	joplin.settings.registerSettings.mockReset();

	joplin.workspace.selectedNote.mockReset();
	joplin.workspace.selectedNote.mockImplementation(async () => undefined);
	joplin.workspace.onNoteSelectionChange.mockReset();
	joplin.workspace.onNoteSelectionChange.mockImplementation(() => makeDisposable());
	joplin.workspace.onNoteChange.mockReset();
	joplin.workspace.onNoteChange.mockImplementation(() => makeDisposable());
	joplin.workspace.onNoteAlarmTrigger.mockReset();
	joplin.workspace.onNoteAlarmTrigger.mockImplementation(() => makeDisposable());
	joplin.workspace.onSyncComplete.mockReset();
	joplin.workspace.onSyncComplete.mockImplementation(() => makeDisposable());

	joplin.commands.register.mockReset();
	joplin.commands.execute.mockReset();
	joplin.commands.execute.mockImplementation(async () => undefined);

	joplin.views.dialogs.create.mockReset();
	joplin.views.dialogs.create.mockImplementation(async () => 'dialog-handle');
	joplin.views.dialogs.setHtml.mockReset();
	joplin.views.dialogs.setHtml.mockImplementation(async () => undefined);
	joplin.views.dialogs.addScript.mockReset();
	joplin.views.dialogs.addScript.mockImplementation(async () => undefined);
	joplin.views.dialogs.open.mockReset();
	joplin.views.dialogs.open.mockImplementation(async () => ({ id: 'ok' }));
	joplin.views.dialogs.showMessageBox.mockReset();
	joplin.views.dialogs.showMessageBox.mockImplementation(async () => 0);
	joplin.views.menus.create.mockReset();
	joplin.views.menus.create.mockImplementation(async () => undefined);
	joplin.views.toolbarButtons.create.mockReset();
	joplin.views.toolbarButtons.create.mockImplementation(async () => undefined);

	joplin.plugins.register.mockReset();
}

export default joplin;
