const path = require('path')
const ya = require('../index.js')

ya.broker([ya.transports.ws(8004)])

const modulePath = path.join(__dirname, 'procedures.js')
ya.server(ya.transports.ws(8004, 'localhost'), modulePath)

const client = ya.client(ya.transports.ws(8004, 'localhost'))

client.remote.sum(1, 2)
  .then(result => {
    console.log(result)
  })
  .catch(error => {
    console.error(error)
  })
/* output:
3
*/
