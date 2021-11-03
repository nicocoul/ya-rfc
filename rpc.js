const logger = require('./logger')(__filename)
const { createRpcClient, createRpcServer } = require('./pubsub')
const { createBroker } = require('./broker')
const { newClient } = require('./client')
//const pubsub = require('./pubsub')
require('./array-extensions')
const fs = require('fs')
const path = require('path')

const procedures = {
    sum2: (a, b) => {
        let counter = 0;
        while (counter < 50000) {
            counter++;
        }
        return counter + a + b
    },
    err: (a, b) => {
        throw new Error('some error')
    },
    mult: (a, b, onProgress) => {
        onProgress(`started ${a}*${b}`)
        return a * b
    },
    nores: (a, b, onProgress) => {
    }
}
module.exports = procedures

async function main() {

    const storePath = 'C:\\topicsRpc'
    try { fs.rmdirSync(storePath, { recursive: true }) } catch (_) { }
    try { fs.mkdirSync(storePath) } catch (_) { }
    const broker = createBroker(8888, 1000, storePath)
    const rpcCient = createRpcClient(newClient('::', 8888))

    // for (let i = 0; i < 1; i++) {
    //     rpcCient.execute('xxx', [1, i], console.log)
    // }
    setTimeout(() => {
        rpcCient.execute('mult', [1, 0], console.log, 'belgium')
        rpcCient.execute('mult', [1, 1], console.log, 'france')
        rpcCient.execute('mult', [1, 2], console.log)
        
    }, 500)
    // for (let i = 0; i < 1; i++) {
    //     rpcCient.execute('nores', [1, i], console.log)
    // }
    // for (let i = 0; i < 1; i++) {
    //     rpcCient.execute('err', [1, i], console.log)
    // }
    // setTimeout(() => {
    //     for (let i = 0; i < 100; i++) {
    //         rpcCient.execute('sum2', [1, i], console.log)
    //     }
    // }, 100)


    createRpcServer(newClient('::', 8888), __filename, 'belgium')
    createRpcServer(newClient('::', 8888), __filename, 'france')
}
if (process.argv.length > 2) {
    main().catch(error => {
        console.error(error.stack)
    })
}

