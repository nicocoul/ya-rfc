const path = require('path')
const ya = require('../index.js')

const namedPipe = path.join('\\\\.\\pipe', 'some-pipe')

ya.broker([ya.transports.ipc(namedPipe)])

const modulePath = path.join(__dirname, 'procedures.js')
ya.server(ya.transports.ipc(namedPipe), modulePath)

const client = ya.client(ya.transports.ipc(namedPipe))

client.remote.sum(1, 2)
  .then(result => {
    console.log(result)
  })
  .catch(error => {
    console.error(error)
  })

/* output:
3
*/
