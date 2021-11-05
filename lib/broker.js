'use strict'

const { newServer } = require('./server')
const { newWrapper } = require('./common')
const { TOPICS } = require('./constants')
const cacheStore = require('./memory-store')
const fsStore = require('./fs-store')
const logger = require('./logger')(__filename)

function newClients() {
    const state = {}
    return {
        set: (c) => {
            state[c.id] = c
        },
        getById: (id) => {
            return state[id]
        },
        removeById: (id) => {
            delete state[id]
        }
    }
}

function newTopicClients() {
    const state = []
    const getIndex = (topic, clientId) => {
        return state.findIndex(s => s.topic === topic && s.clientId === clientId)
    }
    return {
        exists: (topic, clientId) => {
            return getIndex(topic, clientId) !== -1
        },
        add: (topic, clientId, sourceStream) => {
            if (getIndex(topic, clientId) !== -1) return
            state.push({ topic, clientId, sourceStream })
        },
        remove: (topic, clientId) => {
            const index = getIndex(topic, clientId)
            if (index !== -1) {
                state[index].sourceStream.destroy()
                state.splice(index, 1)
            }
        },
        removeClient: (clientId) => {

        },
        clientIdsByTopic: (topic) => {
            return state.filter(s => s.topic === topic).map(s => s.id)
        }
    }
}

function newExecutionContext() {
    const state = []
    const procs = {}
    const affs = {}
    const lds = {}
    const refresh = (clientId) => {
        if (!procs[clientId]) return
        if (!lds[clientId]) return
        state.remove(s => s.clientId === clientId)
        procs[clientId].forEach(procedure => {
            state.push({ procedure, clientId, load: lds[clientId], affinity: affs[clientId] })
        })
    }
    return {
        setClientProcedures: (clientId, procedures, affinity) => {
            procs[clientId] = procedures
            affs[clientId] = affinity
            lds[clientId] = 0.5
            refresh(clientId)
        },
        setClientLoad: (clientId, load) => {
            lds[clientId] = (load.cpu + load.memory) / 2
            refresh(clientId)
        },
        removeClient: (clientId) => {
            state.remove(s => s.clientId === clientId)
            delete procs[clientId]
            delete affs[clientId]
            delete lds[clientId]
        },
        getClientId: (procedure, affinity = null) => {
            logger.debug(`getClientId ${procedure} ${affinity}`)
            const tres = state
                .filter(s => s.procedure === procedure)
                .map(s => ({ ...s, affMatch: (affinity === s.affinity) ? 1 : 0 }))
                .sort((s1, s2) => s1.load - s2.load)
                .sort((s1, s2) => s2.affMatch - s1.affMatch)
            if (tres.length) {
                return tres[0].clientId
            }
        }
    }
}

function newRpcRequests() {
    const state = []
    return {
        add: (id, clientId, procedure, args, affinity) => {
            // console.log('ADD')
            state.push({ id, clientId, procedure, args, affinity, dispatched: false })
        },
        remove: (id) => {
            const index = state.findIndex(s => s.id === id)
            if (index !== -1) {
                state.splice(index, 1)
            }
        },
        get: (id) => {
            const res = state.find(s => s.id === id)
            return { ...res }
        },
        pop: () => {
            return state.find(s => !s.dispatched)
        },
        setLowPriority: (id) => {
            const index = state.findIndex(s => s.id === id)
            if (index !== -1) {
                const save = state[index]
                state.splice(index, 1)
                state.push(save)
            }
        },
        setDispatched: (id) => {
            const r = state.find(s => s.id === id)
            if (r) {
                r.dispatched = true
            }
        },
        resetDispatched: (id) => {
            const r = state.find(s => s.id === id)
            if (r) {
                r.dispatched = false
            }
        },
    }

}

function createBroker(port, cacheTime, storePath) {
    logger.info(`createBroker port=${port} cacheTime=${cacheTime} storePath=${storePath}`)
    const server = newServer(port)
    const clients = newClients()
    const subscribers = newTopicClients()
    const rpcExecContext = newExecutionContext()
    const rpcRequests = newRpcRequests()
    const cache = cacheStore.newStore(cacheTime)
    const store = fsStore.newStore(storePath)

    const initTopic = (topic) => {
        if (!cache.exists(topic)) {
            const count = store.get(topic).count()
            logger.debug
            cache.set(topic, count)
            store.get(topic).pipe(cache.get(topic))
            logger.debug(`topic ${topic}: store pipes to cache`)
        }
    }

    store.getTopicNames().forEach(topicName => {
        initTopic(topicName)
    })

    const runRpc = () => {
        const r = rpcRequests.pop()
        if (!r) return false
        const clientId = rpcExecContext.getClientId(r.procedure, r.affinity)
        if (!clientId) {
            rpcRequests.setLowPriority(r.id)
            return false
        }
        const client = clients.getById(clientId)
        if (!client) return false
        rpcRequests.setDispatched(r.id)
        client.write({ t: TOPICS.RPC_EXECUTE, m: { id: r.id, procedure: r.procedure, args: r.args } })
        return true
    }
    const runRpcs = () => {
        while (runRpc()) { }
    }

    server.on('new-client', c => {
        clients.set(c)
        c.on('data', d => {
            if (!d.t || !d.m) {
                logger.warn(`no t or m for ${JSON.stringify(d)}`)
                return
            }
            initTopic(d.t)
            if (d.t === TOPICS.RPC_EXECUTOR) {
                logger.info(`executor c.id=${c.id} ${JSON.stringify(d.m)}`)
                rpcExecContext.setClientProcedures(c.id, d.m.procedures, d.m.affinity)
                runRpcs()
            } else if (d.t === TOPICS.RPC_EXECUTE) {
                // d is sent by the executor
                if (d.m.result !== undefined || d.m.error !== undefined || d.m.progress !== undefined) {
                    const r = rpcRequests.get(d.m.id)
                    if (!r) return
                    const client = clients.getById(r.clientId)
                    if (!client) return
                    client.write(d)
                    if (d.m.result !== undefined || d.m.error !== undefined) {
                        rpcRequests.remove(d.m.id)
                        runRpcs()
                    }
                } else {
                    if (d.m.cancelled) {
                        // console.log('cancelled')
                        rpcRequests.resetDispatched(d.m.id)
                        runRpcs()
                    } else {
                        rpcRequests.add(d.m.id, c.id, d.m.procedure, d.m.args, d.m.affinity)
                        runRpcs()
                    }
                }
            } else if (d.t === TOPICS.OS_LOAD) {
                // logger.info(`c.id=${c.id} ${JSON.stringify(d.m)}`)
                rpcExecContext.setClientLoad(c.id, d.m)

            } else if (d.t === TOPICS.SUBSCRIBER) {
                const topic = d.m.topic
                const fromOffset = d.m.offset
                initTopic(topic)

                let rs
                if (fromOffset >= cache.get(topic).firstReadableOffset()) {
                    logger.debug(`topic ${topic}: cache streams to channel ${c.id} from offset ${fromOffset}`)
                    rs = cache.get(topic).createReadStream(fromOffset)
                } else {
                    logger.debug(`topic ${topic}: store streams to channel ${c.id} from offset ${fromOffset}`)
                    rs = store.get(topic).createReadStream(fromOffset)
                }
                rs.pipe(newWrapper(topic, fromOffset)).pipe(c)

                if (!subscribers.exists(topic, c.id)) {
                    logger.debug(`topic ${topic}: requiredOffset=${fromOffset}, cache.firstReadableOffset=${cache.get(topic).firstReadableOffset()} cache.count=${cache.get(topic).count()}, store.count=${store.get(topic).count()}`)
                    subscribers.add(topic, c.id, rs)
                } else {
                    logger.debug(`already subscribed ${JSON.stringify(d.m)}`)
                    subscribers.remove(topic, c.id)
                    subscribers.add(topic, c.id, rs)
                }
            } else {
                store.get(d.t).write(d.m)
            }
        })
    })
    server.on('lost-client', c => {
        logger.debug('lost-client')
        // topicSubscribers.removeClient(c.id)
        // clients.removeById(c.id)
    })
    return {
        close: () => {
            logger.info(`closing broker ${port}`)
            server.close()
            store.destroy()
        }
    }
}

module.exports = {
    createBroker
}