const fs = require('fs')
const path = require('path')
const mustache = require('mustache')

const template = fs.readFileSync(path.join(__dirname, '..', 'README.md.tpl'), { encoding: 'utf8' })
const examples = {
  procedures: fs.readFileSync(path.join(__dirname, '..', 'examples', 'procedures.js'), { encoding: 'utf8' }),
  tcp: fs.readFileSync(path.join(__dirname, '..', 'examples', 'rpc-tcp.js'), { encoding: 'utf8' }),
  ws: fs.readFileSync(path.join(__dirname, '..', 'examples', 'rpc-ws.js'), { encoding: 'utf8' })
}

const result = mustache.render(template, { examples })
fs.writeFileSync(path.join(__dirname, '..', 'README.md'), result, { encoding: 'utf8' })
