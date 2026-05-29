import joplin, { resetJoplinMock } from './mocks/api';
import { ModelType } from 'api/types';

describe('test harness wiring', () => {
	it('exposes the joplin data mock', () => {
		expect(joplin.data).toBeDefined();
		expect(typeof joplin.data.get).toBe('function');
	});

	it('re-exports real enum values from api/types', () => {
		expect(ModelType.Note).toBe(1);
	});

	it('exposes resetJoplinMock helper', () => {
		expect(typeof resetJoplinMock).toBe('function');
	});
});
