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
    set: (name, channel) => {
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

function newServer (maxLoad, affinity) {
  let _load = 0
  return {
    addLoad: (load) => {
      _load += load
    },
    removeLoad: (load) => {
      _load -= load
    },
    getLoadEstimate: () => _load / maxLoad,
    getAffinityMatch: (_affinity) => (affinity === _affinity) ? 1 : 0
  }
}

function newCluster () {
  const servers = {}
  function lessBusyServer (affinity = null) {
    const result = Object.values(servers)
      .sort((s1, s2) => s1.getLoadEstimate() - s2.getLoadEstimate())
      .sort((s1, s2) => s2.getAffinityMatch(affinity) - s1.getAffinityMatch(affinity))
    return result[0]
  }
  return {
    add: (name, maxLoad, affinity) => {
      servers[name] = newServer(maxLoad, affinity)
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
    server: (affinity) => {
      const server = lessBusyServer(affinity)
      if (server) {
        return {
          execute: (command) => {
            server.addLoad(command.load)
            server.channel.write(f.commands.execute.toWire(command))
          }
        }
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

function create () {
  const events = new EventEmitter()
  const clients = newClients()
  const cluster = newCluster()
  const scheduledCommands = f.commands.queue.new()
  let _plugin

  function processQueue () {
    while (true) {
      const command = scheduledCommands.shift()
      if (command) {
        const server = cluster.server(command.affinity)
        if (server) {
          events.emit(EVENTS.EXECUTE, f.events.new(command))
          server.execute(command)
        } else {
          scheduledCommands.unshift(command)
          return
        }
      } else {
        return
      }
    }
  }

  function onDoRegisterServer (channel, command) {
    cluster.add(command.name, command.workers, command.affinity)
    cluster.setChannel(command.name, channel)
    processQueue()
  }

  function onDoExecute (channel, command) {
    clients.set(command.clientName, channel)
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
        events.emit(EVENTS.SCHEDULE, f.events.fromWire(data))
        onDoExecute(channel, f.commands.execute.fromWire(data))
        break
      case COMMANDS.CANCEL:
        onDoCancel(f.commands.cancel.fromWire(data))
        break
      case NOTIFICATIONS.PROGRESS:
        onProgress(f.notifications.fromWire(data))
        break
      case NOTIFICATIONS.EXECUTED:
        events.emit(EVENTS.EXECUTED, f.events.fromWire(data))
        onExecuted(f.notifications.fromWire(data))
        break
      case NOTIFICATIONS.FAILED:
        events.emit(EVENTS.FAILED, f.events.fromWire(data))
        onFailed(f.notifications.fromWire(data))
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
    events,
    stats: scheduledCommands.stats
  }
}

module.exports = {
  create
}
