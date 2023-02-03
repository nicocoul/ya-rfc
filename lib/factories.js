const { COMMANDS } = require('./constants')

module.exports = {
  commands: {
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
      procedure: command.pr,
      args: command.ar,
      value
    }),
    fromWireNotification: (data) => ({
      id: data.id,
      procedure: data.pr,
      args: data.ar,
      value: data.v
    })
  }
}
