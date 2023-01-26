const path = require('path')
const net = require('net')
const { pause } = require('../common')
const rpcBroker = require('../../lib/brokers/rpc')
const rpcServer = require('../../lib/clients/rpc-server')
const rpcClient = require('../../lib/clients/rpc-client')
const yac = require('ya-common')
const logger = yac.logger(__filename)
const netPlugin = yac.plugins.net
const netChannel = yac.channels.net

function newServer (port, options) {
  const channel = netChannel({ host: 'localhost', port })
  return rpcServer.create(channel, path.join(__dirname, '..', 'fixtures', 'rpc-module'), options)
}

function newClient (port, reconnectDelay = 50, reconnectAttemps = 5) {
  const channel = netChannel({ host: 'localhost', port }, reconnectDelay, reconnectAttemps)
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
const PORT = 8001
describe('TCP stack', () => {
  test('executes a function that has a return value', async () => {
    const server = newServer(PORT)
    const broker = newBroker(PORT)
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
    server.kill()
    broker.kill()
    client.kill()
    expect(result).toStrictEqual(10)
    expect(count).toStrictEqual(1)
    expect(error).toBeUndefined()
  })

  test('executes a function that has no return value', async () => {
    const server = newServer(PORT)
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
    server.kill()
    rpcBroker.kill()
    client.kill()
    expect(result).toBeUndefined()
    expect(count).toStrictEqual(1)
    expect(error).toBeUndefined()
  })

  test('executes with progression', async () => {
    const server = newServer(PORT)
    const broker = newBroker(PORT)
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
    server.kill()
    broker.kill()
    client.kill()
    expect(error).toBeUndefined()
    expect(count).toStrictEqual(1)
    expect(result).toBeUndefined()
    expect(progress).toStrictEqual([1, 2])
  })

  test('handles errors', async () => {
    const server = newServer(PORT)
    const broker = newBroker(PORT)
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

    server.kill()
    broker.kill()
    client.kill()
    expect(error).toBeDefined()
    expect(result).toBeUndefined()
    expect(count).toStrictEqual(1)
  })

  test('executes when multiple servers', async () => {
    const server1 = newServer(PORT, { workers: 1 })
    const server2 = newServer(PORT, { workers: 1 })
    const broker = newBroker(PORT)
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
    server1.kill()
    server2.kill()
    broker.kill()
    client.kill()

    expect(error).toBeUndefined()
    expect(result).toStrictEqual(10)
    expect(count).toStrictEqual(1)
  })

  test('executes when request is made before server is started', async () => {
    const broker = newBroker(PORT)
    const client = newClient(PORT)
    let result
    let error
    let count = 0

    client.remote.funcWithResult(10)
      .then(res => {
        logger.debug(res)
        count++
        result = res
      })
      .catch(err => {
        logger.warn(err)
        count++
        error = err
      })
    await pause(100)
    logger.debug('will create server')
    const server = newServer(PORT, { workers: 1 })
    await pause(500)
    server.kill()
    broker.kill()
    client.kill()
    logger.debug(`will check, count=${count} result=${result}`)
    expect(error).toBeUndefined()
    expect(count).toStrictEqual(1)
    expect(result).toStrictEqual(10)
  })

  test('executes when broker is started after client and server', async () => {
    const client = newClient(PORT)
    const server = newServer(PORT)
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
    const broker = newBroker(PORT)
    await pause(1000)
    server.kill()
    broker.kill()
    client.kill()

    expect(error).toBeUndefined()
    expect(result).toStrictEqual(10)
    expect(count).toStrictEqual(1)
  })

  test('executes with affinity', async () => {
    const server1 = newServer(PORT, { affinity: 1, workers: 1 })
    const server2 = newServer(PORT, { affinity: 2, workers: 1 })
    const server3 = newServer(PORT, { affinity: 3, workers: 1 })
    const broker = newBroker(PORT)
    const client = newClient(PORT)
    await pause(2000)
    let countServer1 = 0
    let countServer2 = 0
    let countServer3 = 0
    server1.events.on('executed', () => {
      countServer1++
    })
    server2.events.on('executed', () => {
      countServer2++
    })
    server3.events.on('executed', () => {
      countServer3++
    })
    const promises = [
      [...new Array(10)].map(() => client.remote.funcWithResult(10, { affinity: 1 })),
      [...new Array(10)].map(() => client.remote.funcWithResult(10, { affinity: 2 }))
    ].flatMap(el => el)
    await Promise.all(promises)
    server1.kill()
    server2.kill()
    server3.kill()
    broker.kill()
    client.kill()
    expect({ countServer1, countServer2, countServer3 }).toStrictEqual({ countServer1: 10, countServer2: 10, countServer3: 0 })
  }, 100000)

  test('executes with load balancing', async () => {
    const server1 = newServer(PORT, { affinity: 1, workers: 2 })
    const server2 = newServer(PORT, { affinity: 1, workers: 2 })
    const broker = newBroker(PORT)
    const client = newClient(PORT)
    await pause(2000)
    let countServer1 = 0
    let countServer2 = 0
    server1.events.on('executed', () => {
      countServer1++
    })
    server2.events.on('executed', () => {
      countServer2++
    })
    const promises = [...new Array(10)].map(() => client.remote.asyncFunc(10, 100, { affinity: 1 }))
    await Promise.all(promises)
    server1.kill()
    server2.kill()
    broker.kill()
    client.kill()
    expect({ countServer1, countServer2 }).toStrictEqual({ countServer1: 5, countServer2: 5 })
  }, 10000)

  test('cancels when it is executing', async () => {
    const server = newServer(PORT, { workers: 3 })
    const broker = newBroker(PORT)
    const client = newClient(PORT)
    await pause(2000)
    const out1 = [undefined, undefined]
    const out2 = [undefined, undefined]
    const out3 = [undefined, undefined]

    client.remote.asyncFunc('result', 100000, { cancelToken: 'ct1' })
      .then((result) => {
        out1[0] = result
      })
      .catch((error) => {
        out1[1] = error
      })
    client.remote.asyncFunc('result', 100000, { cancelToken: 'ct2' })
      .then((result) => {
        out2[0] = result
      })
      .catch((error) => {
        out2[1] = error
      })
    client.remote.asyncFunc('result', 10, { cancelToken: 'ct3' })
      .then((result) => {
        out3[0] = result
      })
      .catch((error) => {
        out3[1] = error
      })
    await pause(1000)
    client.cancel('ct1')
    await pause(1000)

    await pause(1000)
    server.kill()
    broker.kill()
    client.kill()

    expect(out1[1].code).toStrictEqual('CANCELLED')
    expect(out2).toStrictEqual([undefined, undefined])
    expect(out3).toStrictEqual(['result', undefined])
  }, 10000)

  test('cancels when no server', async () => {
    const broker = newBroker(PORT)
    const client = newClient(PORT)
    await pause(2000)
    const out1 = [undefined, undefined]

    client.remote.asyncFunc('result', 100000, { cancelToken: 'ct1' })
      .then((result) => {
        out1[0] = result
      })
      .catch((error) => {
        out1[1] = error
      })
    await pause(1000)
    client.cancel('ct1')
    await pause(1000)
    broker.kill()
    client.kill()

    expect(out1[1].code).toStrictEqual('CANCELLED')
    expect(out1[0]).toBeUndefined()
  }, 10000)

  test('cancels when no broker', async () => {
    const client = newClient(PORT)
    await pause(2000)
    const out1 = [undefined, undefined]

    client.remote.asyncFunc('result', 100000, { cancelToken: 'ct1' })
      .then((result) => {
        out1[0] = result
      })
      .catch((error) => {
        out1[1] = error
      })
    client.cancel('ct1')
    const broker = newBroker(PORT)
    await pause(100)
    client.kill()
    broker.kill()

    expect(out1[1].code).toStrictEqual('CANCELLED')
    expect(out1[0]).toBeUndefined()
  }, 10000)

  test('reject when broker disconnected', async () => {
    const client = newClient(PORT, 50, 1)
    const broker = newBroker(PORT)
    await pause(1000)

    const count = 10
    let countErrors = 0

    const promises = [...new Array(count)].map(() => {
      return client.remote.asyncFunc(10, 10000)
        .catch(() => { countErrors++ })
    })
    Promise.all(promises)

    await pause(100)
    broker.kill()
    await pause(1000)
    client.kill()

    expect(countErrors).toStrictEqual(count)
  }, 10000)
})
