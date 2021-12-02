const path = require('path')
const net = require('net')
const { pause } = require('../common')
const rpcBroker = require('../../lib/brokers/rpc')
const rpcServer = require('../../lib/clients/rpc-server')
const rpcClient = require('../../lib/clients/rpc-client')
const yac = require('ya-common')
const netPlugin = yac.plugins.net
const netChannel = yac.channels.net

function newServer (port) {
  const channel = netChannel({ host: 'localhost', port })
  return rpcServer.create(channel, path.join(__dirname, '..', 'fixtures', 'rpc-module'))
}

function newClient (port) {
  const channel = netChannel({ host: 'localhost', port })
  return rpcClient.create(channel)
}

function newBroker (port) {
  const server = net.Server()
  const plugin = netPlugin(server)
  const result = rpcBroker.create()
  server.listen(port)
  result.plug(plugin)
  return result
}

describe('TCP stack', () => {
  test('executes a function that has a return value', async () => {
    const PORT = 8080
    const rpcServer = newServer(PORT)
    const rpcBroker = newBroker(PORT)
    const client = newClient(PORT)

    let result
    let error
    let count = 0
    await client.remote.funcWithResult(10)
      .then(res => {
        count++
        result = res
      })
      .catch(err => {
        count++
        error = err
      })
    rpcServer.kill()
    rpcBroker.kill()
    client.kill()
    expect(result).toStrictEqual(10)
    expect(count).toStrictEqual(1)
    expect(error).toBeUndefined()
  })

  test('executes a function that has no return value', async () => {
    const PORT = 8081
    const rpcServer = newServer(PORT)
    const rpcBroker = newBroker(PORT)
    const client = newClient(PORT)

    let result
    let error
    let count = 0
    await client.remote.functWithoutResult(10)
      .then(res => {
        count++
        result = res
      })
      .catch(err => {
        count++
        error = err
      })
    rpcServer.kill()
    rpcBroker.kill()
    client.kill()
    expect(result).toBeUndefined()
    expect(count).toStrictEqual(1)
    expect(error).toBeUndefined()
  })

  test('executes with progression', async () => {
    const PORT = 8082
    const rpcServer = newServer(PORT)
    const rpcBroker = newBroker(PORT)
    const client = newClient(PORT)

    let result
    let error
    const progress = []
    let count = 0
    await client.remote.funcWithProgress({ onProgress: p => progress.push(p) })
      .then(res => {
        count++
        result = res
      })
      .catch(err => {
        count++
        error = err
      })
    rpcServer.kill()
    rpcBroker.kill()
    client.kill()
    expect(error).toBeUndefined()
    expect(count).toStrictEqual(1)
    expect(progress.find(p => p === 'done')).toBeDefined()
    expect(result).toBeUndefined()
  })

  test('executes with status', async () => {
    const PORT = 8083
    const rpcServer = newServer(PORT)
    const rpcBroker = newBroker(PORT)
    const client = newClient(PORT)

    let result
    let error
    const statuses = []
    let count = 0
    await client.remote.funcWithProgress({ onStatus: p => statuses.push(p) })
      .then(res => {
        count++
        result = res
      })
      .catch(err => {
        count++
        error = err
      })
    rpcServer.kill()
    rpcBroker.kill()
    client.kill()
    expect(error).toBeUndefined()
    expect(count).toStrictEqual(1)
    expect(result).toBeUndefined()
    expect(statuses).toStrictEqual(['scheduled', 'started', 'end'])
  })

  test('handles errors', async () => {
    const PORT = 8084
    const rpcServer = newServer(PORT)
    const rpcBroker = newBroker(PORT)
    const client = newClient(PORT)

    let result
    let error
    let count = 0
    await client.remote.functThatThrows()
      .then(res => {
        count++
        result = res
      })
      .catch(err => {
        count++
        error = err
      })

    rpcServer.kill()
    rpcBroker.kill()
    client.kill()
    expect(error).toBeDefined()
    expect(result).toBeUndefined()
    expect(count).toStrictEqual(1)
  })

  // test('executes 1000 in less than 500ms', async () => {
  //   const PORT = 8085
  //   const rpcServer = newServer(PORT)
  //   const rpcBroker = newBroker(PORT)
  //   const client = newClient(PORT)
  //   const eCount = 1000
  //   let result
  //   let error
  //   let count = 0
  //   await pause(200)
  //   for (let i = 0; i < eCount; i++) {
  //     client.remote.funcWithResult(10)
  //       .then(res => {
  //         count++
  //         result = res
  //       })
  //       .catch(err => {
  //         count++
  //         error = err
  //       })
  //   }
  //   await pause(500)
  //   rpcServer.kill()
  //   rpcBroker.kill()
  //   client.kill()
  //   expect(result).toStrictEqual(10)
  //   expect(count).toStrictEqual(eCount)
  //   expect(error).toBeUndefined()
  // })

  test('executes when multiple servers', async () => {
    const PORT = 8086
    const rpcServer1 = newServer(PORT)
    const rpcServer2 = newServer(PORT)
    const rpcBroker = newBroker(PORT)
    const client = newClient(PORT)
    await pause(300)
    let result
    let error
    let count = 0
    await client.remote.funcWithResult(10)
      .then(res => {
        count++
        result = res
      })
      .catch(err => {
        count++
        error = err
      })
    rpcServer1.kill()
    rpcServer2.kill()
    rpcBroker.kill()
    client.kill()
    expect(result).toStrictEqual(10)
    expect(count).toStrictEqual(1)
    expect(error).toBeUndefined()
  })

  test('executes when request is made before any server is started', async () => {
    const PORT = 8087
    const rpcBroker = newBroker(PORT)
    const client = newClient(PORT)
    let result
    let error
    let count = 0
    client.remote.funcWithResult(10)
      .then(res => {
        count++
        result = res
      })
      .catch(err => {
        count++
        error = err
      })
    const rpcServer = newServer(PORT)
    await pause(300)
    rpcServer.kill()
    rpcBroker.kill()
    client.kill()
    expect(result).toStrictEqual(10)
    expect(count).toStrictEqual(1)
    expect(error).toBeUndefined()
  })

  test('executes when broker is started after client and server', async () => {
    const PORT = 8088
    const client = newClient(PORT)
    const rpcServer = newServer(PORT)
    let result
    let error
    let count = 0
    client.remote.funcWithResult(10)
      .then(res => {
        count++
        result = res
      })
      .catch(err => {
        count++
        error = err
      })

    await pause(100)
    const rpcBroker = newBroker(PORT)
    await pause(300)
    rpcServer.kill()
    rpcBroker.kill()
    client.kill()
    expect(result).toStrictEqual(10)
    expect(count).toStrictEqual(1)
    expect(error).toBeUndefined()
  })
})
