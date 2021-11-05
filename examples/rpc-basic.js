const { createBroker, createRpcClient, createRpcServer } = require('../index.js')
const path = require('path')

createBroker({ port: 8888 })

const modulePath = path.join(__dirname, 'procedures.js')

createRpcServer({ host: '::', port: 8888, modulePath })

const rpcCient = createRpcClient({ host: '::', port: 8888 })

rpcCient.execute('count', [5000], (error, result) => {
  if (!error) {
    console.log('result', result)
  } else {
    console.error(error)
  }
})
