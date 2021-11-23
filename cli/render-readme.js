const fs = require('fs')
const path = require('path')
const mustache = require('mustache')

const template = fs.readFileSync(path.join(__dirname, '..', 'README.md.tpl'), { encoding: 'utf8' })
const examples = {
  pubSubLocal: fs.readFileSync(path.join(__dirname, '..', 'examples', 'pubsub-local.js'), { encoding: 'utf8' }),
  pubSubTcp: fs.readFileSync(path.join(__dirname, '..', 'examples', 'pubsub-tcp.js'), { encoding: 'utf8' }),
  pubSubWs: fs.readFileSync(path.join(__dirname, '..', 'examples', 'pubsub-ws.js'), { encoding: 'utf8' })
}

const result = mustache.render(template, { examples })
fs.writeFileSync(path.join(__dirname, '..', 'README.md'), result, { encoding: 'utf8' })
