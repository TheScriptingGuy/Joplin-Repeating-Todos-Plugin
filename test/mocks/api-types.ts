// Re-export the real enums/types from the Joplin API type definitions so that
// tests get the exact numeric/string values used by the source under test.
//
// `api/types.ts` is a self-contained file (it only declares interfaces, enums
// and types and imports nothing from Joplin internals), so it compiles standalone
// and can be safely re-exported here.
export {
	ModelType,
	SettingItemType,
	MenuItemLocation,
	ToolbarButtonLocation,
} from '../../api/types';

// Also re-export everything else so any additional type imports from `api/types`
// resolve correctly during tests.
export * from '../../api/types';
