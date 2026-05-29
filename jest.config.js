module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/src', '<rootDir>/test'],
	testMatch: ['**/test/**/*.test.ts'],
	moduleNameMapper: {
		'^api/types$': '<rootDir>/test/mocks/api-types.ts',
		'^api$': '<rootDir>/test/mocks/api.ts',
	},
	transform: {
		'^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
	},
	clearMocks: true,
};
