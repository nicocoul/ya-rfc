const { WebSocketServer } = require('ws')
const path = require('path')
const ya = require('../index.js')

const broker = ya.broker()
broker.plug(ya.plugins.ws(new WebSocketServer({ port: 8004 })))

const modulePath = path.join(__dirname, 'procedures.js')
ya.server.ws({ host: 'localhost', port: 8004 }, modulePath)

const rpcClient = ya.client.ws({ host: 'localhost', port: 8004 })
// execute procedure count from the client
// rpcClient.execute('count', [10000], (err, data) => {
//   if (!err) {
//     console.log(data)
//   }
// })

rpcClient.remote.count(100, { onProgress: console.log, onStatus: console.log })
  .then(result => {
    console.log(result)
  })
  .catch(error => {
    console.error(error)
  })

/* output:
10000
*/
