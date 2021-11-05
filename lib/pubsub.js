'use strict'
const { TOPICS } = require('./constants')
const path = require('path')
const { fork } = require("child_process");
const logger = require('./logger')(__filename)
function addPublisherRole(client) {
    const publish = (topic, message) => {
        client.write({ t: topic, m: message })
    }
    return { publish }
}

function newRequests() {
    const state = []
    const getIndex = (id) => {
        return state.findIndex(s => s.request.id === id)
    }
    return {
        add: (request, callback) => {
            state.push({ request, callback })
        },
        remove: (id) => {
            const index = getIndex(id)
            if (index !== -1) {
                state.splice(index, 1)
            }
        },
        get: (id) => {
            const index = getIndex(id)
            if (index !== -1) {
                return state[index]
            }
        }
    }
}

function addRpcClientRole(client) {

    const requests = newRequests()
    let requestId = new Date().getTime()

    client.on('data', d => {
        if (!d.t) {
            logger.warn(`${client.id}: no .t in received data`)
            return
        }
        if (d.t !== TOPICS.RPC_EXECUTE) return
        if (d.m.id) {
            if (d.m.error !== undefined) {
                try {
                    requests.get(d.m.id).callback(d.m.error, undefined, undefined)
                    requests.remove(d.m.id)
                } catch (error) {
                    logger.error(`execute role, ${JSON.stringify(d.m)} ${error.message}`)
                }

            } else if (d.m.result !== undefined) {
                try {
                    requests.get(d.m.id).callback(undefined, d.m.result, undefined)
                    requests.remove(d.m.id)
                } catch (error) {
                    logger.error(`execute role, ${JSON.stringify(d.m)} ${error.message}`)
                }
            } else if (d.m.progress !== undefined) {
                requests.get(d.m.id).callback(undefined, undefined, d.m.progress)
            }
        }
    })

    const execute = (procedure, args, callback, affinity) => {
        requestId++
        const request = { id: requestId, procedure, args, affinity }
        client.write({ t: TOPICS.RPC_EXECUTE, m: request })
        requests.add(request, callback)
    }
    return { execute }
}


function newTopics() {
    const state = {}
    return {
        set: (topic) => {
            if (!state[topic])
                state[topic] = { offset: -1, callbacks: [] }
        },
        setOffset: (topic, offset) => {
            state[topic].offset = offset
        },
        getOffset: (topic) => {
            return state[topic].offset
        },
        addCallback: (topic, callback) => {
            state[topic].callbacks.push(callback)
        },
        getCallbacks: (topic) => {
            return state[topic].callbacks
        },
        exists: (topic) => {
            return state[topic] !== undefined
        },
        removeCallbacks: (topic) => {
            state[topic].callbacks.length = 0
        },
        all: () => {
            return Object.keys(state)
        }
    }
}

function addSubscriberRole(client, subscribeDelay = 30000) {
    const topics = newTopics()
    let notifyBrokerTimeout

    client.on('data', d => {
        // logger.debug(JSON.stringify(d))
        if (!d.t) {
            logger.warn(`${client.id}: no .t in received data`)
            return
        }
        if (d.t === TOPICS.RPC_EXECUTE) return
        if (!topics.exists(d.t)) {
            logger.warn(`${client.id}: unknown .t ${d.t} in received data`)
            return
        }
        if (d.o === undefined || d.m === undefined) {
            logger.warn(`${client.id}: undefined .o or .m for .t ${d.t}`)
            return
        }
        if (d.o !== topics.getOffset(d.t) + 1) {
            return
        }
        // logger.debug(`topic:${d.t} ,${JSON.stringify(d)}`)
        topics.getCallbacks(d.t).forEach(callback => {
            topics.setOffset(d.t, d.o)
            try {
                callback(d.m)
            } catch (error) {
                console.error(error)
            }
        })
    })

    const notifyBroker = () => {
        topics.all().forEach(topic => {
            client.write({ t: TOPICS.SUBSCRIBER, m: { topic, offset: topics.getOffset(topic) + 1 } })
        })
        if (notifyBrokerTimeout) clearTimeout(notifyBrokerTimeout)
        notifyBrokerTimeout = setTimeout(() => {
            notifyBroker()
        }, subscribeDelay)
    }
    const subscribe = (topic, callback) => {
        topics.set(topic)
        client.write({ t: TOPICS.SUBSCRIBER, m: { topic, offset: topics.getOffset(topic) + 1 } })
        topics.addCallback(topic, callback)
    }
    const unsubscribe = (topic) => {
        topics.removeCallbacks(topic)
    }

    notifyBroker()

    const destroy = () => {
        if (notifyBrokerTimeout) clearTimeout(notifyBrokerTimeout)
    }

    return { subscribe, unsubscribe, destroy }
}

function newChildProcess() {
    const state = []
    let i = 0
    return {
        add: (process) => {
            state.push(process)
        },
        removeByPid: (pid) => {
            const index = state.findIndex(p => p.pid === pid)
            if (index !== -1) {
                state.splice(index, 1)
            }
        },
        pop: () => {
            i = i % state.length
            const p = state[i]
            i++
            return p
        }
    }
}

function addRpcServerRole(client, modulePath, affinity = null, childProcessesCount = 5) {
    const childProcesses = newChildProcess()
    const createChildProcess = () => {
        const childProcess = fork(path.join(__dirname, 'rpc-child.js'))
        childProcess.send({ modulePath })
        childProcess.on('error', (error) => {
            logger.error(error.stack)
        })
        childProcess.on('close', (code) => {
            childProcesses.removeByPid(childProcess.pid)
            logger.debug(`child process closed with code ${code}`)
            createChildProcess()
        })
        childProcess.on('message', data => {
            if (data.procedure) {
                client.write({ t: TOPICS.RPC_EXECUTE, m: data })
            } else if (data.cpu) {
                client.write({ t: TOPICS.OS_LOAD, m: data })
            }
        })
        childProcesses.add(childProcess)
    }
    for (let i = 0; i < childProcessesCount; i++) {
        createChildProcess()
    }

    const procedures = require(modulePath)
    client.on('data', async d => {
        if (!modulePath) {
            return
        }
        if (!d.t) {
            logger.warn(`${client.id}: no .t in received data`)
            return
        }
        if (d.t !== TOPICS.RPC_EXECUTE) return

        if (!d.m.procedure) {
            logger.warn(`no procedure defined`)
            client.write({ t: TOPICS.RPC_EXECUTE, m: { ...d.m, error: `no procedure defined` } })
            return
        }
        const { procedure } = d.m
        if (!Object.keys(procedures).includes(procedure)) {
            logger.warn(`procedure ${procedure} not found`)
            client.write({ t: TOPICS.RPC_EXECUTE, m: { ...d.m, error: `procedure ${procedure} not found` } })
            return
        }
        try {
            console.log(`execute ${procedure} on ${affinity}`)
            childProcesses.pop().send(d.m)
        } catch (error) {
            logger.error(error.stack)
            client.write({ t: TOPICS.RPC_EXECUTE, m: { ...d.m, error: error.message } })
        }
    })

    client.on('connect', () => {
        const procedureNames = Object.keys(procedures)
        if (procedureNames.length) {
            client.write({ t: TOPICS.RPC_EXECUTOR, m: { procedures: Object.keys(procedures), affinity } })
        }
    })
    const destroy = () => {
        if (notifyTimeout) clearTimeout(notifyTimeout)
    }

    return { destroy }
}

function createPubSubClient(client) {
    const subscriberRole = addSubscriberRole(client, notifyDelay)
    const publisherRole = addPublisherRole(client)
    return {
        subscribe: subscriberRole.subscribe,
        unsubscribe: subscriberRole.unsubscribe,
        publish: publisherRole.publish,
        destroy: () => {
            client.destroy()
            subscriberRole.destroy()
        }
    }
}

function createRpcClient(client) {
    const rpcClientRole = addRpcClientRole(client)
    return {
        execute: rpcClientRole.execute,
        destroy: () => {
            client.destroy()
        }
    }
}

function createRpcServer(client, modulePath, affinity, childProcessesCount) {
    addRpcServerRole(client, modulePath, affinity, childProcessesCount)
    return {
        destroy: () => {
            client.destroy()
        }
    }
}

module.exports = {
    createPubSubClient,
    createRpcClient,
    createRpcServer
}