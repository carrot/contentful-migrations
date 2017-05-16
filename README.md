# Contentful Migrations

[![npm](https://img.shields.io/npm/v/contentful-migrations.svg?style=flat-square)](https://npmjs.com/package/contentful-migrations)
[![tests](https://img.shields.io/travis/jescalan/contentful-migrations.svg?style=flat-square)](https://travis-ci.org/jescalan/contentful-migrations?branch=master)
[![dependencies](https://img.shields.io/david/jescalan/contentful-migrations.svg?style=flat-square)](https://david-dm.org/jescalan/contentful-migrations)
[![coverage](https://img.shields.io/coveralls/jescalan/contentful-migrations.svg?style=flat-square)](https://coveralls.io/r/jescalan/contentful-migrations?branch=master)

programmatic content model control for contentful

> **Note:** This project was extracted from client work and is a bit rough around the edges and does not current have tests. Eventually we will add them but for now be careful!

### Why should you care?

If you are running a production contentful project, chances are you need different environments for production, staging, testing, etc. that need to have the same content models, but different actual content. For example, your production environment might have articles written by editors that are live on your site/app, and your test environment might be seeded by scripts and QA staff with test content to see if they can break the system and find any bugs.

Doing this by hand through contentful's content model editor is a dangerous and imprecise process especially between multiple environments. Using the import/export tools will overwrite the content in addition to content models so this is not viable. So you need a content model migration tool, just like you would use a database migration tool to manage your database schema. This is it, for contentful.

### Installation

`npm install contentful-migrations -s`

### Usage

Easiest way to get an idea of how to use this is an example!

```js
const Migrations = require('contentful-migrations')

const migration = new Migrations({
  id: 'xxx',
  token: 'xxx',
  models: 'path/to/models/folder'
})

migration.migrateContentTypes().then(console.log)
```

The `id` and `token` are your contentful space id and management token, respectively. The `models` param is a path to a folder that contains one or more model definitions. The model definitions are not super well documented by contentful. First, again, an example of a model file:

```js
module.exports = {
  id: 'author',
  name: 'Author',
  description: 'A person who writes posts',
  displayField: 'name',
  fields: [{
    id: 'name',
    name: 'Name',
    type: 'Symbol',
    required: true
  }, {
    id: 'slug',
    name: 'url',
    type: 'Symbol',
    required: true,
    validations: [{
      unique: true
    }, {
      regexp: { pattern: '[A-Za-z0-9-]' },
      message: 'URL must only include letters, numbers, and hyphens'
    }],
    appearance: {
      widgetId: 'slugEditor',
      settings: { helpText: 'URL must only include letters, numbers, and hyphens' }
    }
  }, {
    id: 'bio',
    name: 'Bio',
    type: 'Text',
    required: true
  }, {
    id: 'socialMedia',
    name: 'Social Media',
    type: 'Array',
    required: false,
    items: {
      type: 'Link',
      linkType: 'Entry',
      validations: [{
        linkContentType: ['socialMedia']
      }]
    },
    appearance: {
      widgetId: 'entryLinksEditor',
      settings: { bulkEditing: false }
    }
  }, {
    id: 'image',
    name: 'Image',
    type: 'Link',
    linkType: 'Asset',
    required: false,
    validations: [{
      linkMimetypeGroup: ['image']
    }]
  }]
}
```

This looks complex, but really just describes all the things you set up in your content model. The name, id, and type of your fields, as well as whether they are required, any validations, and field appearance if there is one.

These fields were reverse-engineered out of the API response for when you manually create the content model from their interface then fetch it via API. Better docs would be great from contentful, or from a friendly contributor who would be interested in adding them to this readme. In general, what you see above will cover most use cases though.

So, basically you make a folder full of the js model definitions, then just pass the path to that folder and run the migration library, and it will make the magic happen. You can pass a different environment's id depending on where you want it to update.

### License & Contributing

- Details on the license [can be found here](LICENSE.md)
- Details on running tests and contributing [can be found here](contributing.md)
