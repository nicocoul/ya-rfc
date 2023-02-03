const { COMMANDS } = require('./constants')

function newCommandQueue () {
  const state = []
  return {
    add: (command) => {
      const index = state.findIndex(s => s.priority > command.priority)
      if (index === -1) {
        state.push(command)
      } else {
        state.splice(index, 0, command)
      }
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
    },
    unshift: (command) => {
      state.unshift(command)
    },
    length: () => {
      return state.length
    },
    stats: () => {
      return state.reduce((accumulated, command) => {
        if (!accumulated[command.procedure]) {
          accumulated[command.procedure] = 0
        }
        accumulated[command.procedure]++
        return accumulated
      }, {})
    }
  }
}

module.exports = {
  commands: {
    queue: {
      new: newCommandQueue
    },
    execute: {
      new: (clientName, id, procedure, args = [], cancelToken, affinity = null, priority = 0, load = 1) => ({
        c: COMMANDS.EXECUTE,
        cn: clientName,
        id,
        pr: procedure,
        ar: args,
        af: affinity,
        pi: priority,
        l: load,
        ct: cancelToken || id
      }),
      toWire: (command) => ({
        c: COMMANDS.EXECUTE,
        cn: command.clientName,
        id: command.id,
        pr: command.procedure,
        ar: command.args,
        af: command.affinity,
        pi: command.priority,
        l: command.load,
        ct: command.cancelToken
      }),
      fromWire: (data) => ({
        c: COMMANDS.EXECUTE,
        clientName: data.cn,
        id: data.id,
        procedure: data.pr,
        args: data.ar,
        affinity: data.af,
        priority: data.pi,
        load: data.l,
        cancelToken: data.ct
      })
    },
    cancel: {
      new: (id, procedure, load) => ({
        c: COMMANDS.CANCEL,
        id,
        pr: procedure,
        l: load
      }),
      toWire: (command) => ({
        c: COMMANDS.CANCEL,
        id: command.id,
        pr: command.procedure,
        l: command.load
      }),
      fromWire: (data) => ({
        c: COMMANDS.CANCEL,
        id: data.id,
        procedure: data.pr,
        load: data.l
      })
    },
    registerSerer: {
      new: (name, affinity, workers) => ({
        c: COMMANDS.REGISTER_SERVER,
        n: name,
        a: affinity,
        w: workers
      }),
      toWire: (command) => ({
        c: COMMANDS.REGISTER_SERVER,
        n: command.name,
        a: command.affinity,
        w: command.workers
      }),
      fromWire: (command) => ({
        command: COMMANDS.REGISTER_SERVER,
        name: command.n,
        affinity: command.a,
        workers: command.w
      })
    }
  },
  notifications: {
    fromWire: (data) => ({
      c: data.c,
      clientName: data.cn,
      serverName: data.sn,
      id: data.id,
      procedure: data.pr,
      args: data.ar,
      load: data.l,
      value: data.v
    }),
    toWire: (notification) => ({
      c: notification.c,
      cn: notification.clientName,
      sn: notification.serverName,
      id: notification.id,
      pr: notification.procedure,
      ar: notification.args,
      l: notification.load,
      v: notification.value
    }),
    new: (type, serverName, command, value) => ({
      c: type,
      cn: command.clientName,
      sn: serverName,
      id: command.id,
      pr: command.procedure,
      ar: command.args,
      l: command.load,
      v: value
    })
  },
  events: {
    new: (command, value) => ({
      id: command.id,
      procedure: command.procedure,
      args: command.args,
      value
    }),
    fromWire: (data) => ({
      id: data.id,
      procedure: data.pr,
      args: data.ar,
      value: data.v
    })
  },
  errors: {
    fromWire: ([message, code]) => {
      const err = new Error(message)
      if (code) {
        err.code = code
      }
      return err
    },
    toWire: (error) => {
      return [error.message, error.code]
    },
    lostBroker: () => {
      const err = new Error('lost broker')
      err.code = 'LOST_BROKER'
      return err
    },
    cancelled: (id) => {
      const err = new Error(`cancelled ${id}`)
      err.code = 'CANCELLED'
      return err
    },
    noProcedure: (procedure, id) => {
      const err = new Error(`no procedure ${procedure} defined for request ${id}`)
      err.code = 'NO_PROCEDURE'
      return err
    }
  }
}
