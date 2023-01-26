'use strict'

module.exports = {
  COMMANDS: {
    REGISTER_SERVER: 1,
    REGISTER_CLIENT: 2,
    EXECUTE: 3,
    CANCEL: 4
  },
  NOTIFICATIONS: {
    FAILED: 10,
    CANCELLED: 11,
    PROGRESS: 12,
    EXECUTED: 13
  },
  EVENTS: {
    SCHEDULE: 'schedule',
    PROGRESS: 'progress',
    EXECUTE: 'execute',
    EXECUTED: 'executed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    NEW_CHANNEL: 'new-channel',
    LOST_CHANNEL: 'lost-channel'
  }
}
