const { WebSocketServer } = require('ws')
const path = require('path')
const ya = require('../index.js')

const broker = ya.broker()
broker.plug(ya.plugins.ws(new WebSocketServer({ port: 8004 })))

const modulePath = path.join(__dirname, 'procedures.js')
ya.server.ws({ host: 'localhost', port: 8004 }, modulePath)

// execute procedure count from the client
const rpcClient = ya.client.ws({ host: 'localhost', port: 8004 })
rpcClient.execute('count', [10000], (err, data) => {
  if (!err) {
    console.log(data)
  }
})

/* output:
10000
*/
