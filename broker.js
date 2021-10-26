const { newServer } = require('./server')
const { newWrapper } = require('./common')
const { TOPICS } = require('./constants')
const cacheStore = require('./cacheStore')
const fsStore = require('./fileSystemStore')
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

function newBroker(port, cacheTime, storePath) {
    logger.info(`newBroker port=${port} cacheTime=${cacheTime} storePath=${storePath}`)
    const server = newServer(port)
    const clients = newClients()
    const subscribers = newTopicClients()
    const cache = cacheStore.newStore(cacheTime)
    const store = fsStore.newStore(storePath)

    initTopic = (topic) => {
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

    server.on('new-client', c => {
        clients.set(c)
        c.on('data', d => {
            if (!d.t || !d.m) {
                logger.warn(`no t or m for ${JSON.stringify(d)}`)
                return
            }
            if (d.t === TOPICS.SUBSCRIBER) {
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
                const topic = d.t
                const message = d.m
                initTopic(topic)
                store.get(topic).write(message)
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
    newBroker
}