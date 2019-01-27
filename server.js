const WebSocketServer = require('websocket').server
const http = require('http')

const server = http.createServer((request, response) => {})
server.listen(8888, () => {})

const wsServer = new WebSocketServer({
  httpServer: server
})

let clientCounter = 1
const clients = {}

console.log('started')

wsServer.on('request', request => {
  let connection = request.accept(null, request.origin)
  let clientId = clientCounter++

  clients[clientId] = connection

  connection.on('message', message => {
    if(message.type !== 'utf8') {
      return
    }

    for(let otherClientId of Object.keys(clients)) {
      if(otherClientId == clientId) {
        continue
      }

      //console.log(clientId, '---->', otherClientId, message)

      clients[otherClientId].sendUTF(message.utf8Data)
    }
  })

  connection.on('close', connection => {
    delete clients[clientId]
  })
})
