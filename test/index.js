const contentful-migrations = require('..')
const test = require('ava')

test('basic', (t) => {
  t.is(contentful-migrations, 'test')
})
