'use strict'

module.exports = {
  COMMANDS: {
    REGISTER_SERVER: 1,
    EXECUTE: 2,
    CANCEL: 3
  },
  NOTIFICATIONS: {
    FAILED: 10,
    CANCELLED: 11,
    PROGRESS: 12,
    EXECUTED: 13
  },
  EVENTS: {
    SCHEDULE: 'schedule',
    EXECUTE: 'execute',
    EXECUTED: 'executed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    NEW_CHANNEL: 'new-channel',
    LOST_CHANNEL: 'lost-channel'
  }
}
