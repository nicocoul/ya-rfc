const net = require('net')
const path = require('path')
const { rpc, plugins } = require('../index.js')

// create broker
const broker = rpc.broker()
broker.plug(plugins.broker.net(net.Server().listen(8002)))

// create rpc servers
const modulePath = path.join(__dirname, 'procedures.js')
const rpcServer1 = rpc.server.net({ host: 'localhost', port: 8002 }, modulePath)
const rpcServer2 = rpc.server.net({ host: 'localhost', port: 8002 }, modulePath)

// execute procedure count from the client
const rpcClient = rpc.client.net({ host: 'localhost', port: 8002 })
rpcClient.execute('count', [10000], (err, data) => {
  if (!err) {
    console.log('result is', data)
  }
}, {
  onProgress: (progress) => {
    console.log(progress)
  }
})
