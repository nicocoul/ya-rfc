'use strict'
/* eslint-disable no-empty */
const EventEmitter = require('events')

const yac = require('ya-common')
const logger = yac.logger(__filename)
const { COMMANDS, NOTIFICATIONS, EVENTS } = require('../constants')
const f = require('../factories')

function newClients () {
  const state = {}
  return {
    add: (name, channel) => {
      logger.info(`set channel ${name} ${channel.id}`)
      state[name] = { channel }
    },
    get: (name) => {
      return state[name]
    },
    remove: (name) => {
      logger.info(`remove channel ${name}`)
      if (state[name]) {
        delete state[name]
        return true
      }
      return false
    }
  }
}

function newServer (affinity = null, workers) {
  let _load = 0
  return {
    addLoad: (load) => {
      _load += load
    },
    removeLoad: (load) => {
      _load -= load
    },
    getLoadEstimate: () => _load / workers,
    getAffinityMatch: (_affinity) => (affinity === _affinity) ? 1 : 0
  }
}

function newCluster () {
  const servers = {}
  function lessBusyServer (affinity = null) {
    const result = Object.values(servers)
      .sort((s1, s2) => s1.getLoadEstimate() - s2.getLoadEstimate())
      .sort((s1, s2) => s2.getAffinityMatch(affinity) - s1.getAffinityMatch(affinity))
    if (result.length) {
      return result[0]
    }
  }
  return {
    add: (name, affinity, maxLoad) => {
      servers[name] = newServer(affinity, maxLoad)
    },
    setChannel: (name, channel) => {
      servers[name].channel = channel
    },
    removeLoad: (name, load) => {
      if (!servers[name]) return
      servers[name].removeLoad(load)
    },
    remove: (name) => {
      if (servers[name]) {
        delete servers[name]
        return true
      } else {
        return false
      }
    },
    execute: (command) => {
      const server = lessBusyServer(command.procedure, command.affinity)
      if (server) {
        server.addLoad(command.load)
        server.channel.write(f.commands.execute.toWire(command))
      }
    },
    cancel: (command) => {
      const c = f.commands.cancel.toWire(command)
      Object.values(servers).forEach(server => {
        server.channel.write(c)
      })
    },
    kill: () => {
      Object.keys(servers).forEach(name => {
        servers[name].channel.kill()
        delete servers[name]
      })
    }
  }
}

function newCommands () {
  const state = []
  return {
    add: (command) => {
      state.push(command)
    },
    get: (id) => {
      const res = state.find(s => s.id === id)
      return { ...res }
    },
    removeById: (id) => {
      const index = state.findIndex(s => s.id === id)
      if (index !== -1) {
        state.splice(index, 1)
      }
    },
    shift: () => {
      return state.shift()
    }
  }
}

function create () {
  const events = new EventEmitter()
  const clients = newClients()
  const cluster = newCluster()
  const scheduledCommands = newCommands()
  let _plugin

  function processQueue () {
    let command
    while ((command = scheduledCommands.shift()) !== undefined) {
      cluster.execute(command)
    }
  }

  function onDoRegisterServer (channel, command) {
    cluster.add(command.name, command.affinity, command.workers)
    cluster.setChannel(command.name, channel)
    processQueue()
  }

  function onDoRegisterClient (channel, command) {
    clients.add(command.name, channel)
  }

  function onDoExecute (command) {
    scheduledCommands.add(command)
    processQueue()
  }

  function onDoCancel (command) {
    cluster.cancel(command)
    const execCommand = scheduledCommands.get(command.id)
    events.emit(EVENTS.CANCELLED, f.events.new(execCommand))
    scheduledCommands.removeById(execCommand.id)
    processQueue()
  }

  function onFailed (notification) {
    cluster.removeLoad(notification.serverName, notification.load)
    const client = clients.get(notification.clientName)
    if (client) {
      client.channel.write(f.notifications.toWire(notification))
    } else {
      logger.warn(`client ${notification.clientName} not found`)
    }
    processQueue()
  }

  function onExecuted (notification) {
    cluster.removeLoad(notification.serverName, notification.load)
    const client = clients.get(notification.clientName)
    if (client) {
      client.channel.write(f.notifications.toWire(notification))
    } else {
      logger.warn(`client ${notification.clientName} not found, onExecuted`)
    }
    processQueue()
  }

  function onProgress (notification) {
    const client = clients.get(notification.clientName)
    if (client) {
      client.channel.write(f.notifications.toWire(notification))
    } else {
      logger.warn(`client ${notification.clientName} not found`)
    }
  }

  function handleChannelData (channel, data) {
    switch (data.c) {
      case COMMANDS.EXECUTE:
        events.emit(EVENTS.SCHEDULE, f.events.fromWireNotification(data))
        onDoExecute(f.commands.execute.fromWire(data))
        break
      case COMMANDS.CANCEL:
        onDoCancel(f.commands.cancel.fromWire(data))
        break
      case NOTIFICATIONS.PROGRESS:
        onProgress(f.notifications.fromWire(data))
        break
      case NOTIFICATIONS.EXECUTED:
        events.emit(EVENTS.EXECUTED, f.events.fromWireNotification(data))
        onExecuted(f.notifications.fromWire(data))
        break
      case NOTIFICATIONS.FAILED:
        events.emit(EVENTS.FAILED, f.events.fromWireNotification(data))
        onFailed(f.notifications.fromWire(data))
        break
      case COMMANDS.REGISTER_CLIENT:
        onDoRegisterClient(channel, f.commands.registerClient.fromWire(data))
        break
      case COMMANDS.REGISTER_SERVER:
        onDoRegisterServer(channel, f.commands.registerSerer.fromWire(data))
        break
    }
  }

  function plug (plugin) {
    _plugin = plugin
    plugin.on('new-channel', channel => {
      logger.info(`new channel ${channel.id}`)
      events.emit(EVENTS.NEW_CHANNEL, { id: channel.id })
      channel.on('data', (data) => {
        handleChannelData(channel, data)
      })
    })
    plugin.on(EVENTS.LOST_CHANNEL, channel => {
      cluster.remove(channel.id)
      clients.remove(channel.id)
      logger.warn(`lost channel ${channel.id}`)
      events.emit(EVENTS.LOST_CHANNEL, { id: channel.id })
    })
  }
  function kill () {
    events.removeAllListeners()
    _plugin.kill()
    cluster.kill()
  }
  return {
    plug,
    kill,
    events
  }
}

module.exports = {
  create
}
