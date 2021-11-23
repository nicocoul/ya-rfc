const { WebSocketServer } = require('ws')
const path = require('path')
const { rpc, plugins } = require('../index.js')

// create broker
const broker = rpc.broker()
broker.plug(plugins.broker.ws(new WebSocketServer({ port: 8004 })))

// create rpc servers
const modulePath = path.join(__dirname, 'procedures.js')
rpc.server.ws({ host: 'localhost', port: 8004 }, modulePath)

// execute procedure count from the client
const rpcClient = rpc.client.ws({ host: 'localhost', port: 8004 })
rpcClient.execute('count', [10000], (err, data) => {
  if (!err) {
    console.log('result is', data)
  }
}, {
  onProgress: (progress) => {
    console.log('progress', progress)
  },
  onStatus: (status) => {
    console.log('status', status)
  }
})
