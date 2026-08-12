'use strict';

module.exports = {
  testDir: 'tests',
  testMatch: /newtab\.e2e\.js$/,
  reporter: 'list',
  timeout: 180000,
  expect: {
    timeout: 15000
  },
  workers: 1
};
