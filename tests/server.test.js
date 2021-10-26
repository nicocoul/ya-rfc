const { newServer } = require('../server')
const { newClient } = require('../client')
const { pause} = require('./common')
const logger = require('../logger')(__filename)

const PORT = 8081
const HOST = '::'

test('it closes', async () => {
    const server = newServer(PORT)
    await pause(100)
    server.close()
})

/*
test('it receives objects', async () => {
    const server = newServer(PORT)
    const received = []
    server.on('new-client', c => {
        c.on('data', (data) => {
            received.push(data)
        })
    })
    // expect(server.address.port).toStrictEqual(PORT)
    // expect(server.address.host).toStrictEqual('::')
    const client1 = newClient(HOST, PORT)
    const client2 = newClient(HOST, PORT)
    client1.write({ id: 1 })
    client2.write({ id: 2 })
    
    await pause(50)
    await client1.destroy()
    await client2.destroy()
    server.close()

    expect(received.length).toStrictEqual(2)


})
*/

// test('client connects to server when server is started after client', async () => {
//     const client = newWsClient('localhost', PORT, 50)
//     client.connect()

//     await delay(() => {
//     }, 100)

//     const server = newWsServer(PORT, 50)
//     const regs = []
//     server.on('reg', (clientId) => {
//         regs.push(clientId)
//     })

//     return delay(() => {
//         client.disconnect()
//         server.close()
//         expect(regs).toStrictEqual([client.id])
//     }, 100)
// })

/*
test('server receives messages from a client', async () => {

    const server = newWsServer(PORT, 300)
    const ms = []
    server.on('message', (_, message) => {
        ms.push(message)
    })

    const client = newWsClient('localhost', PORT, 100)
    client.connect()

    client.send({ id: 1 })
    client.send({ id: 2 })


    return delay(() => {
        client.disconnect()
        server.close()
        expect(ms.map(m => m.id)).toStrictEqual([1, 2])
    }, 200)
})

test('server receives messages from multiple clients', async () => {
    const server = newWsServer(PORT, 300)
    const ms = []
    server.on('message', (_, message) => {
        ms.push(message)
    })

    const client1 = newWsClient('localhost', PORT, 300)
    client1.connect()

    const client2 = newWsClient('localhost', PORT, 300)
    client2.connect()

    client1.send({ id: 1 })
    client1.send({ id: 2 })
    client2.send({ id: 1 })
    client2.send({ id: 2 })


    return delay(() => {
        client1.disconnect()
        client2.disconnect()
        server.close()
        expect(ms.filter(m => m.c === client1.id).map(m => m.id)).toStrictEqual([1, 2])
        expect(ms.filter(m => m.c === client2.id).map(m => m.id)).toStrictEqual([1, 2])
    }, 200)
})

test('server does not loose messages when client reconnects', async () => {
    const server = newWsServer(PORT, 100)
    const ms = []
    server.on('message', (_, message) => {
        ms.push(message)
    })

    const client = newWsClient('localhost', PORT, 100)
    client.connect()

    client.send({ id: 1 })
    client.send({ id: 2 })

    client.disconnect()
    await delay(() => { }, 100)

    client.send({ id: 3 })
    client.send({ id: 4 })

    await delay(() => { client.connect() }, 100)

    return delay(() => {
        client.disconnect()
        server.close()
        expect(ms.map(m => m.id)).toStrictEqual([1, 2, 3, 4])
    }, 200)
})

test('server sends messages to a client', async () => {
    const server = newWsServer(PORT, 50)

    const client1 = newWsClient('localhost', PORT, 50)
    client1.connect()
    const ms = []
    client1.on('message', (message) => {
        ms.push(message)
    })

    await delay(() => { }, 100)

    server.send(client1.id, { id: 1 })
    server.send(client1.id, { id: 2 })

    return delay(() => {
        client1.disconnect()
        server.close()
        expect(ms.map(m => m.id)).toStrictEqual([1, 2])
    }, 100)
})


test('server sends messages to clients', async () => {
    const server = newWsServer(PORT, 50)

    const client1 = newWsClient('localhost', PORT, 50)
    client1.connect()
    const ms1 = []
    client1.on('message', (message) => {
        ms1.push(message)
    })

    const client2 = newWsClient('localhost', PORT, 50)
    client2.connect()
    const ms2 = []
    client2.on('message', (message) => {
        ms2.push(message)
    })

    await delay(() => { }, 100)

    server.send(client1.id, { id: 1 })
    server.send(client1.id, { id: 2 })

    server.send(client2.id, { id: 3 })
    server.send(client2.id, { id: 4 })

    return delay(() => {
        client1.disconnect()
        client2.disconnect()
        server.close()
        expect(ms1.map(m => m.id)).toStrictEqual([1, 2])
        expect(ms2.map(m => m.id)).toStrictEqual([3, 4])
    }, 200)
})



test('server receives 400 messages from a client in less than 1000ms', async () => {

    const server = newWsServer(PORT, 50)
    const ms = []
    server.on('message', (message) => {
        ms.push(message)
    })

    const client = newWsClient('localhost', PORT, 50)
    client.connect()

    await delay(() => { }, 1000)

    for (let id = 0; id < 400; id++) {
        client.send({ id })
    }

    return delay(() => {
        client.disconnect()
        server.close()
        expect(ms.length).toBe(400)
    }, 1000)
})
*/