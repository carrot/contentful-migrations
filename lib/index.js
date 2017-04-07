const fs = require('fs')
const fetch = require('node-fetch')
const Throttle = require('promise-throttle')

module.exports = (conf) => {
  const client = new Client({ id: conf.id, token: conf.token })
  const models = fs.readdirSync(__dirname).map((f) => require(`./${f}`))

  return Promise.all(models.map((m) => client.updateContentModel(m)))
}

class Client {
  constructor (auth) {
    this.id = auth.id
    this.managementToken = auth.token
    this.url = `https://api.contentful.com/spaces/${this.id}`
    // contentful has a 10 req/s rate limit, we stay under this comfortably
    this.queueStore = new Throttle({
      requestsPerSecond: 7,
      promiseImplementation: Promise
    })
    this.queue = this.queueStore.add.bind(this.queueStore)
    this.fetch = (...args) => this.queue(fetch.bind(this, ...args))
  }

  /**
   * Updates a contentful model
   * @see https://www.contentful.com/developers/docs/references/content-management-api/#/reference/content-types/content-type
   * @param {Object} opts - options passed to contentful API
   * @param {String} opts.id - content model id
   * @param {String} opts.name - content model name
   * @param {String} opts.fields - content model fields
   * @returns {Promise} promise for updated model
   */
  updateContentModel (opts) {
    const id = opts.id
    delete opts.id

    const appearances = opts.fields.reduce((m, i) => {
      if (i.appearance) { m.push({ id: i.id, appearance: i.appearance }) }
      delete i.appearance
      return m
    }, [])

    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/vnd.contentful.management.v1+json'
    }
    const resourceUrl = `${this.url}/content_types/${id}`
    const editorInterfaceUrl = `${resourceUrl}/editor_interface`

    // check to see if the model already exists
    return this.fetch(resourceUrl, { headers })
    .then((res) => res.json())
    .then((ct) => ct.sys.version)
    .then((version) => {
      const headersCopy = Object.assign({}, headers)
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
        headers: Object.assign({}, headers, {
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
      return this.fetch(editorInterfaceUrl, { headers })
      .then((res) => res.json())
      .then((res) => res.sys.version)
      .then((version) => {
        // update all editor interfaces for the current model
        return this.fetch(editorInterfaceUrl, {
          method: 'PUT',
          headers: Object.assign({}, headers, {
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
}
