const fs = require('fs')
const fetch = require('node-fetch')
const Throttle = require('promise-throttle')

class Client {
  constructor (config) {
    const queueStore = new Throttle({
      requestsPerSecond: 7,
      promiseImplementation: Promise
    })

    Object.assign(this, {
      id: config.id,
      managementToken: config.token,
      managementHeaders: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/vnd.contentful.management.v1+json'
      },
      spaceUrl: `https://api.contentful.com/spaces/${config.id}`,
      entriesPath: config.entries,
      modelsPath: config.models,
      // contentful has a 10 req/s rate limit, we stay under this comfortably
      queueStore: queueStore,
      queue: queueStore.add.bind(queueStore)
    })

    this.fetch = (...args) => this.queue(fetch.bind(this, ...args))
  }

  setModelsPath (path) {
    this.modelsPath = path
  }

  setEntriesPath (path) {
    this.entriesPath = path
  }

  migrateContentTypes () {
    const models = fs.readdirSync(this.modelsPath).map((f) =>
      require(`${this.modelsPath}/${f}`)
    )
    return Promise.all(models.map((m) => this.updateContentModel(m)))
  }

  migrateEntries () {
    const entries = fs.readdirSync(this.entriesPath).map((f) =>
      require(`${this.entriesPath}/${f}`)
    )
    return Promise.all(entries.map((e) => {
      console.log(e)
    }))
  }

  /**
   * Updates a contentful content type
   * @see https://www.contentful.com/developers/docs/references/content-management-api/#/reference/content-types/content-type
   * @param {Object} opts - options passed to contentful API
   * @param {String} opts.id - content model id
   * @param {String} opts.name - content model name
   * @param {String} opts.fields - content model fields
   * @returns {Promise} promise for updated model
   */
  updateContentType (opts) {
    const id = opts.id
    delete opts.id

    const appearances = opts.fields.reduce((m, i) => {
      if (i.appearance) { m.push({ id: i.id, appearance: i.appearance }) }
      delete i.appearance
      return m
    }, [])

    const resourceUrl = `${this.spaceUrl}/content_types/${id}`
    const editorInterfaceUrl = `${resourceUrl}/editor_interface`

    // check to see if the model already exists
    return this.fetch(resourceUrl, { this.managementHeaders })
    .then((res) => res.json())
    .then((ct) => ct.sys.version)
    .then((version) => {
      const headersCopy = Object.assign({}, this.managementHeaders)
      // if it exists, we add the version to the headers to update
      if (version) {
        headersCopy['X-Contentful-Version'] = version
      }
      // create or update the model
      return this.fetch(resourceUrl, {
        method: 'PUT',
        headers: headersCopy,
        body: JSON.stringify(opts)
      }).then((res) => res.json())
    })
    // now we activate (save) the model
    .then((createResponse) => {
      return this.fetch(`${resourceUrl}/published`, {
        method: 'PUT',
        // we need the version to activate it as well, its incremented from
        // the update above
        headers: Object.assign({}, this.managementHeaders, {
          'X-Contentful-Version': createResponse.sys.version
        })
      }).then((res) => res.json())
        .then((activateResponse) => {
          return {createResponse, activateResponse}
        })
    })
    // now we update the "editor interface"
    .then((prevResponse) => {
      // if there were no editor interface updated, we can return
      if (!appearances.length) return prevResponse

      // format editor interface params
      const controls = appearances.map((a) => {
        return Object.assign({ fieldId: a.id }, a.appearance)
      })

      // if there was one, get the previous interface so we have the version
      return this.fetch(editorInterfaceUrl, { this.managementHeaders })
      .then((res) => res.json())
      .then((res) => res.sys.version)
      .then((version) => {
        // update all editor interfaces for the current model
        return this.fetch(editorInterfaceUrl, {
          method: 'PUT',
          headers: Object.assign({}, this.managementHeaders, {
            'X-Contentful-Version': version
          }),
          body: JSON.stringify({ controls })
        })
      })
      .then((res) => res.json())
      .then((appearanceResponse) => {
        return Object.assign({}, prevResponse, { appearanceResponse })
      })
    })
  }

  createEntry (opts) {
    if (!opts.sys.contentType.sys.id) {
      return new Error('Create requires a content type id for entry.')
    }

    return this.fetch(resourceUrl, {
      headers: Object.assign({}, this.managementHeaders, {
        'X-Contentful-Content-Type': opt.sys.contentType.sys.id
      })
    })
  }

  updateEntry (opts) {
    if (!opts.sys.contentType.sys.id) {
      return new Error('Update requires a content type id for entry.')
    }
    if (!opts.sys.id) {
      return new Error('Entry requires id to update')
    }

    const resourceUrl = `${this.spaceUrl}/entries/${opts.sys.id}`
    return this.fetch(resourceUrl, {
      method: 'PUT',
      headers: Object.assign({}, this.managementHeaders, {
        'X-Contentful-Content-Type': opts.sys.contentType.sys.id
      }),
      body: JSON.stringify(opts.fields)
    })
    .then((res) => res.json())
  }
}

module.exports = Client
