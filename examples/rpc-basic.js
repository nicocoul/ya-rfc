const { rpc } = require('../index.js')
const path = require('path')

rpc.createBroker({ port: 8888 })

const modulePath = path.join(__dirname, 'procedures.js')
rpc.createServer({ host: '::', port: 8888, modulePath })

const rpcCient = rpc.createClient({ host: '::', port: 8888 })
rpcCient.execute('count', [50], ({ progress, result, error }) => {
  console.log(progress, result, error)
})
