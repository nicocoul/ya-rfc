const { newServer } = require('../server')
const { newClient } = require('../client')
const { pause } = require('./common')

const PORT = 8084
const HOST = '::'

test('it sends objects to server', async () => {
  const received = []

  const client = newClient(HOST, PORT)
  client.write({ id: 1 })
  client.write({ id: 2 })
  await pause(150)
  const server = newServer(PORT)
  server.on('new-client', c => {
    c.on('data', (data) => {
      received.push(data)
    })
  })
  await pause(150)
  client.destroy()
  server.close()

  expect(received).toStrictEqual([{ id: 1 }, { id: 2 }])
})

test('it receives objects from server', async () => {
  const received = []

  const client = newClient(HOST, PORT)
  client.on('data', data => {
    received.push(data)
  })

  await pause(150)
  const server = newServer(PORT)
  server.on('new-client', c => {
    c.on('data', (data) => {
      received.push(data)
    })
    c.write({ id: 1 })
    c.write({ id: 2 })
  })
  await pause(150)
  client.destroy()
  server.close()

  expect(received).toStrictEqual([{ id: 1 }, { id: 2 }])
})
/*
test('it throws when sending and when client was destroyed', async () => {
    const server = newServer(PORT)
    server.on('new-client', c => {
        c.on('data', (data) => {
            logger.debug(JSON.stringify(data))
        })
    })
    const client = newClient(HOST, PORT)
    client.write({ id: 1 })
    await pause(50)
    await client.destroy()
    try {
        expect(() => client.write({ id: 2 })).toThrow()
    } catch (error) {
        logger.error(error.stack)
    } finally {
        server.close()
    }
})

test('it throws when sending and when server was closed', async () => {
    const server = newServer(PORT)
    server.on('new-client', c => {
        c.on('data', (data) => {
            logger.debug(JSON.stringify(data))
        })
    })
    const client = newClient(HOST, PORT)
    client.write({ id: 1 })
    await pause(50)
    server.close()
    await pause(50)
    try {
        expect(() => client.write({ id: 2 })).toThrow()
    } catch (error) {
        logger.error(error.stack)
    } finally {
        await client.destroy()
        server.close()
    }
})
*/

/*
test('it throws when sending not supported data', async () => {
    const server = await newServer(PORT)
    const received = []
    server.on('new-client', c => {
        c.on('data', (data) => {
            received.push(data)
        })
    })
    const client = await newClient(HOST, PORT)
    client.write({ id: 1 })
    client.write('toto')
    client.write({ id: 2 })
    await pause(50)
    client.destroy()
    server.close()
    expect(received).toHaveLength(2)
    expect(received).toStrictEqual([{ id: 1 }, { id: 2 }])

})
*/

/*
test('it receives objects', async () => {
    const server = await newServer(PORT)
    const received = []
    server.on('new-client', c => {
        c.on('data', (data) => {
            received.push(data)
        })
    })
    // expect(server.address.port).toStrictEqual(PORT)
    // expect(server.address.host).toStrictEqual('::')
    const client1 = await newClient(HOST, PORT)
    const client2 = await newClient(HOST, PORT)
    client1.write({ id: 1 })
    client2.write({ id: 2 })

    await pause(50)

    expect(received.length).toStrictEqual(2)

    await client1.destroy()
    await client2.destroy()
    server.close()
})
*/
