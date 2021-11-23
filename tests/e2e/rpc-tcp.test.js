const path = require('path')
const net = require('net')
const { pause } = require('../common')
const rpcBroker = require('../../lib/brokers/rpc')
const rpcServer = require('../../lib/clients/rpc-server')
const rpcClient = require('../../lib/clients/rpc-client')
const netChannel = require('../../lib/clients/channels/net')
const netPlugin = require('../../lib/brokers/plugins/net')

//const PORT = 8080

function newServer (port) {
  const channel = netChannel.create('localhost', port)
  return rpcServer.create(channel, path.join(__dirname, 'fixtures', 'rpc-module'))
}

function newClient (port) {
  const channel = netChannel.create('localhost', port)
  return rpcClient.create(channel)
}

function newBroker (port) {
  const server = net.Server()
  const plugin = netPlugin.create(server)
  const result = rpcBroker.create()
  server.listen(port)
  result.plug(plugin)
  return result
}

describe('Rpc TCP stack', () => {
  test('executes', async () => {
    const rpcServer = newServer(8080)
    const rpcBroker = newBroker(8080)
    const client = newClient(8080)

    let result
    let error
    let count = 0
    client.execute('funcWithResult', [10], (err, res) => {
      count++
      if (!err) {
        result = res
      } else {
        error = err
      }
    })

    await pause(300)
    rpcServer.destroy()
    rpcBroker.destroy()
    client.destroy()
    expect(result).toStrictEqual(10)
    expect(count).toStrictEqual(1)
    expect(error).toBeUndefined()
  })

  test('executes with progression', async () => {
    const rpcServer = newServer(8081)
    const rpcBroker = newBroker(8081)
    const client = newClient(8081)

    let result
    let error
    const progress = []
    let count = 0
    client.execute('funcWithProgress', [], (err, res) => {
      count++
      if (!err) {
        result = res
      } else {
        error = err
      }
    }, {
      onProgress: p => {
        progress.push(p)
      }
    })

    await pause(300)
    rpcServer.destroy()
    rpcBroker.destroy()
    client.destroy()
    expect(error).toBeUndefined()
    expect(count).toStrictEqual(1)
    expect(progress.find(p => p === 'done')).toBeDefined()
    expect(result).toStrictEqual(null)
  })

  test('handles errors', async () => {
    const rpcServer = newServer(8082)
    const rpcBroker = newBroker(8082)
    const client = newClient(8082)

    let result
    let error
    let count = 0
    client.execute('functThatThrows', [], (err, res) => {
      count++
      if (!err) {
        result = res
      } else {
        error = err
      }
    })

    await pause(300)
    rpcServer.destroy()
    rpcBroker.destroy()
    client.destroy()
    expect(error).toBeDefined()
    expect(result).toBeUndefined()
    expect(count).toStrictEqual(1)
  })

  test('executes 1000', async () => {
    const rpcServer = newServer(8083)
    const rpcBroker = newBroker(8083)
    const client = newClient(8083)
    const eCount = 300
    let result
    let error
    let count = 0
    await pause(500)
    for (let i = 0; i < eCount; i++) {
      client.execute('funcWithResult', [10], (err, res) => {
        count++
        if (!err) {
          result = res
        } else {
          error = err
        }
      })
    }
    await pause(500)
    rpcServer.destroy()
    rpcBroker.destroy()
    client.destroy()
    expect(result).toStrictEqual(10)
    expect(count).toStrictEqual(eCount)
    expect(error).toBeUndefined()
  })
})
