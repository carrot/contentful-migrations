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

#### Migrating Models (Content Types)
```js
const Migrations = require('contentful-migrations')

const migration = new Migrations({
  id: 'xxx',
  token: 'xxx',
  models: 'path/to/models/folder'
})

migration.migrateContentTypes().then(console.log)
```

The `id` and `token` are your contentful space id and management token, respectively. The `models` param is a path to a folder that contains one or more model definitions.

The model definitions are not super well documented by contentful. These fields were reverse-engineered out of the API response for when you manually create the content type model from their interface then fetch it via API. Better docs would be great from contentful, or from a friendly contributor who would be interested in adding them to this readme. In general, what you see above will cover most use cases for a content type though.

First, again, an example of a model file (_Note: The model's `id` property, will be `undefined` in Contentful if not provided during migration_):

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

So, basically you make a folder full of the js model definitions, then just pass the path to that folder and run the migration library, and it will make the magic happen. You can pass a different environment's id depending on where you want it to update.

#### Seeding/Migrating Entries (for Content Types)
Migrating (or seeding) entries works much like migrating content types.
First, you set up the migration client making sure to provide a path to a folder of `entries`.

```js
const Migrations = require('contentful-migrations')

const migration = new Migrations({
  id: 'xxx',
  token: 'xxx',
  entries: 'path/to/entries/folder',
  models: 'path/to/models/folder' // both paths can be defined from the start
})

// Or you can set the `models` or `entries` path after instantiating the client
migration.setModelsPath('different/path/to/models')
migration.setEntriesPath('different/path/to/entries')

// Create entries from folder in the configured space, using the supplied `id`
// if provided, or letting Contentful generate one if not.
migration.seedEntries().then(console.log)

// Update entries from folder in the configured space
migration.migrateEntries().then(console.log)
```

An entry file simply exports an `Array` of Entry Objects, each with a unique `id`, a `contentTypeId`, and a `fields` object containing the desired values for each field defined on the entry's content type model. This is more clearly demonstrated below with an example of an entry file (using the `Author` model above):

(_Note: You may choose to use Contentful's Entry object as a guide and leave its `sys` metadata in place and/or pull the desired values from there. `contentful-migration`'s create and update functions will use the `id` in `sys` over the top level `id` if available._)

```js
module.exports = [{
  "id": "author1", // *required* for updating (migrating)
  "contentTypeId": "author", // *required* for seeding
  /** optional, but takes precedence over above keys if provided
  "sys": {
    "id": "author1",
    "contentType": { // content type meta data, per contentful docs
      "sys": {
        "type": "Link",
        "linkType": "ContentType",
        "id": "author"
      }
    }
  },
  */
  "fields": {
    "name": {
      "en-US": "Carrot Creative"
    },
    "slug": {
      "en-US": "carrot-creative"
    },
    "bio": {
      "en-US": "A full-service digital agency"
    },
    "socialMedia": {
      "en-US": [ // Array of linked Entries' metadata in "sys"
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "socialMediaEntry1"
          }
        },
        {
          "sys": {
            "type": "Link",
            "linkType": "Entry",
            "id": "socialMediaEntry2"
          }
        }
      ]
    },
    "image": {
      "en-US": { // Object of Image Asset's metadata in "sys"
        "sys": {
          "type": "Link",
          "linkType": "Asset",
          "id": "image1"
        }
      }
    }
  }
}]
```

## Difference between Seeding and Migrating Entries
You may encounter issues if you attempt to **update** an entry in a space with an `id` that doesn't exist or if you attempt to **create** an entry without a `contentTypeId`. In short:

**Seeding:** you may omit the `id` if you want Contentful to generate an `id` for the entry itself, which you'll have to retrieve manually if you intend to migrate (or update) using this package in the future. **You must** provide a `contentTypeId` when creating the Entry in either case.

**Migrating:** you may omit the `contentTypeId` but **you must** provide an `id` for a proper update of the existing entry in Contentful.


### License & Contributing

- Details on the license [can be found here](LICENSE.md)
- Details on running tests and contributing [can be found here](contributing.md)
