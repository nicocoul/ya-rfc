const logger = require('./logger')(__filename)
// const { start } = require('./node')
const { newClient } = require('./client')
const { newServer } = require('./server')
const { newBroker } = require('./broker')
const { newChannel, newEncoder, newDecoder } = require('./common')
const { Readable } = require('stream')
const fileSystemStore = require('./fileSystemStore')
// const { stdout, stdin } = require('process')
const pubsub = require('./pubsub')
const fs = require('fs')
const path = require('path')

class DummyReadable extends Readable {
    constructor(arr) {
        super({ objectMode: true })
        arr.forEach(el => this.push(el))
    }

    _read() { }
}

async function main0() {

    const e = newEncoder()
    const d = newDecoder()
    const c = newChannel()
    const r = new DummyReadable([{ id: 1 }])
    c.on('data', (data) => {
        console.log(data)
    })
    r.pipe(e).pipe(d).pipe(c)
}

async function main1() {
    const server = newServer(8888)
    server.on('new-client', (channel) => {
        channel.on('data', (data) => {
            console.log(data)
        })
        channel.write({ id: 3 })
    })

    setTimeout(() => {

        const client = newClient('::', 8888)
        client.write({ id: 1 })
        client.write({ id: 2 })
        client.on('data', data => {
            console.log(data)
        })
    }, 1000)
}

async function main2() {

    const subs0 = await start(8889, [{ host: '::', port: 8889 }])
    const subs1 = await start(8890, [{ host: '::', port: 8889 }])
    const pub0 = await start(8891, [{ host: '::', port: 8889 }])
    const pub1 = await start(8892, [{ host: '::', port: 8889 }])


    pub0.publish('toto', { coco: 'lolo1' })
    pub0.publish('toto', { coco: 'lolo2' })
    pub0.publish('toto', { coco: 'lolo3' })
    subs0.subscribe('toto', (message) => {
        console.log('8889', message)
    })
    subs1.subscribe('toto', (message) => {
        console.log('8890', message)
    })
    pub0.publish('toto', { coco: 'lolo4' })
    pub1.publish('toto', { coco: 'lolo5' })

    console.log(new Date().toString())
    for (let i = 0; i < 10; i++) {
        pub0.publish('toto', { x: i })
    }
}

async function main3() {
    newBroker(8888)

    const p = newClient('::', 8888)
    const s1 = newClient('::', 8888)
    const s2 = newClient('::', 8888)

    s1.write({ t: '_int_subscriber', m: { topic: 'topic1', offset: 0 } })
    s2.write({ t: '_int_subscriber', m: { topic: 'topic1', offset: 0 } })
    p.write({ t: '_int_publisher', m: { topic: 'topic1' } })
    for (let i = 0; i < 1; i++) {
        p.write({ t: 'topic1', m: { id: i } })
    }

    s1.on('data', data => {
        console.log('s1', data)
    })
    s2.on('data', data => {
        console.log('s2', data)
    })
}

async function main4() {
    const storePath = 'C:\\topics2'
    try { fs.rmdirSync(storePath, { recursive: true }) } catch (_) { }
    try { fs.mkdirSync(storePath) } catch (_) { }
    const broker = newBroker(8888, 1000, storePath)
    const p = pubsub.start('::', 8888)
    const s1 = pubsub.start('::', 8888)
    const s2 = pubsub.start('::', 8888)
    // const p = newClient('::', 8888)

    // p.write({t:'_int_publisher', m:{topic:'topic1'}})

    let i = 0
    for (i = 0; i < 10; i++) {
        p.publish('main', { id: i })
    }

    s1.subscribe('main', message => {
        console.log('s1', message)
    })

    setTimeout(() => {
        s2.subscribe('main', message => {
            console.log('s2', message)
        })
    }, 500)

    while (i < 100000) {
        p.publish('main', { id: i })
        i++
    }
    setTimeout(() => {
        s1.destroy()
        s2.destroy()
        p.destroy()
        broker.close()
    }, 50000)
}

async function main5() {
    const store = fileSystemStore.create(path.join(__dirname, 'tests', 'data'))

    for (i = 0; i < 1000; i++) {
        store.persist('topicX', { id: i }, i)
    }
    store.createReadStream('topicX', 3).on('data', (data) => {
        console.log(data[0])
    })
    setTimeout(() => console.log('end'), 50000)
}


main4().catch(error => {
    console.error(error.stack)
})