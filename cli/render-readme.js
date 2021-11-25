const fs = require('fs')
const path = require('path')
const mustache = require('mustache')

const https = require('https')

function convert (mermaidPath, pngPath) {
  const utf8 = fs.readFileSync(mermaidPath, { encoding: 'utf8' })
  //const encoded = encodeURIComponent(utf8)
  const base64 = Buffer.from(utf8).toString('base64')
  const ws = fs.createWriteStream(pngPath)
  const req = https.request({ hostname: 'mermaid.ink', path: `/img/${base64}`, method: 'GET', port: 443 }, res => {
    res.on('data', data => {
      ws.write(data)
    })
  })
  req.on('error', console.error)
  req.end()
}

console.log(encodeURIComponent('test?'))

// examples
const examples = {
  procedures: fs.readFileSync(path.join(__dirname, '..', 'examples', 'procedures.js'), { encoding: 'utf8' }),
  tcp: fs.readFileSync(path.join(__dirname, '..', 'examples', 'rpc-tcp.js'), { encoding: 'utf8' }),
  ws: fs.readFileSync(path.join(__dirname, '..', 'examples', 'rpc-ws.js'), { encoding: 'utf8' })
}

const mrdPath = path.join(__dirname, '..', 'mrd')
const imgPath = path.join(__dirname, '..', 'img')
fs.readdirSync(mrdPath).forEach(entry => {
  convert(path.join(mrdPath, entry), path.join(imgPath, `${path.parse(entry).name}.png`))
})

const template = fs.readFileSync(path.join(__dirname, 'README.md.tpl'), { encoding: 'utf8' })
const result = mustache.render(template, { examples })
fs.writeFileSync(path.join(__dirname, '..', 'README.md'), result, { encoding: 'utf8' })
