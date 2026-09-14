module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./tests/jest.setup.js'],
  setupFilesAfterEnv: ['./tests/jest.cleanup.js'],
  verbose: true,
  testTimeout: 10000,
  testPathIgnorePatterns: [],
};
