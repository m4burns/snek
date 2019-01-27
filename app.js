"use strict";

const UP = 'up', DOWN = 'down', LEFT = 'left', RIGHT = 'right'

const dRow = {
  [UP]: -1,
  [DOWN]: 1,
  [LEFT]: 0,
  [RIGHT]: 0
}
const dCol = {
  [UP]: 0,
  [DOWN]: 0,
  [LEFT]: -1,
  [RIGHT]: 1
}

function randInt(begin, end) {
  return Math.round(Math.random()*(end - begin)) + begin
}

function randGuid() {
    let S4 = () => {
       return (((1+Math.random())*0x10000)|0).toString(16).substring(1)
    }
    return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4())
}

class SnakeController {
  constructor(snake, initRow, initCol, initDir, targetLength) {
    this.snake = snake
    snake.segments = [ { row: initRow, col: initCol } ]
    this.currentDir = initDir
    this.targetLength = targetLength

    document.addEventListener('keypress', evt => this.dispatch(evt))

    snake.game.controllers.push(this)
  }

  dispatch(evt) {
    if(!evt.code) {
      return false
    }

    switch(evt.code) {
      case 'KeyW': this.go(UP); return true
      case 'KeyD': this.go(RIGHT); return true
      case 'KeyS': this.go(DOWN); return true
      case 'KeyA': this.go(LEFT); return true
    }

    console.log('missed it', evt)

    return false
  }

  go(dir) {
    this.currentDir = dir
  }

  run() {
    let game = this.snake.game

    let { row, col } = this.snake.segments[0]
    let newRow = row + dRow[this.currentDir]
    let newCol = col + dCol[this.currentDir]

    // ran into edges
    if(newRow >= game.rows
       || newRow < 0
       || newCol >= game.cols
       || newCol < 0)
    {
      return false
    }

    const sameAsNewSeg = x => x.row === newRow && x.col === newCol

    // ran into self or other
    for(let snake of game.snakes) {
      if(snake.segments.find(sameAsNewSeg)) {
        return false
      }
    }

    // ate an apple
    let appleIndex = game.apples.findIndex(sameAsNewSeg)
    if(appleIndex >= 0) {
      game.removeApple(appleIndex)
      this.targetLength += 1
    }

    this.snake.segments.unshift({ row: newRow, col: newCol })

    if(this.snake.segments.length > this.targetLength) {
      this.snake.segments.pop()
    }

    this.snake.broadcastSelf()

    return true
  }
}

class Snake {
  constructor(game, playerId) {
    this.game = game
    this.playerId = playerId || this.game.playerId
    this.segments = []

    game.snakes.push(this)
  }

  draw() {
    for(let segment of this.segments) {
      this.game.drawSegment(segment.row, segment.col)
    }
  }

  broadcastSelf() {
    this.game.broadcast('updateSnake', {
      playerId: this.playerId,
      segments: this.segments
    })
  }

  update(newSegments) {
    this.segments = newSegments
  }
}

class Apple {
  constructor(game, row, col) {
    this.game = game
    this.row = row
    this.col = col
  }

  draw() {
    this.game.drawSegment(this.row, this.col)
  }
}

class Game {
  constructor(comm, canvas, rows, cols) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.comm = comm

    this.rows = rows
    this.cols = cols

    this.snakes = []
    this.controllers = []
    this.apples = []

    this.targetApples = 5

    this.playerId = randGuid()
    this.comm.addListener((verb, data) => this.receive(verb, data))

    this.broadcast('createPlayer', this.playerId)

    this.intervalId = window.setInterval(() => this.run(), 100)
  }

  broadcast(verb, data) {
    this.comm.broadcast(verb, data)
  }

  receive(verb, data) {
    switch(verb) {
      case 'createPlayer':
        this.createRemotePlayer(data)
        break
      case 'deletePlayer':
        this.deleteRemotePlayer(data)
        break
      case 'updateSnake':
        this.updateRemoteSnake(data)
        break
      case 'createApple':
        this.createRemoteApple(data)
        break
      case 'deleteApple':
        this.deleteRemoteApple(data)
        break
    }
  }

  createRemotePlayer(playerId) {
    this.snakes.push(new Snake(this, playerId))
  }

  deleteRemotePlayer(playerId) {
    let snakeIndex = this.snakes.findIndex(x => x.playerId === playerId)
    if(snakeIndex >= 0) {
      this.snake.slice(snakeIndex, 1)
    }
  }

  updateRemoteSnake(data) {
    let snake = this.snakes.find(x => x.playerId === data.playerId)
    if(!snake) {
      return
    }

    snake.update(data.segments)
  }

  createRemoteApple(data) {
    this.apples.push(new Apple(this, data.row, data.col))
  }

  deleteRemoteApple(data) {
    let index = this.apples.findIndex(x => x.row === data.row && x.col === data.col)
    if(index >= 0) {
      this.apples.slice(index, 1)
    }
  }

  drawSegment(row, col) {
    let { ctx, canvas, cols, rows } = this

    let cellWidth = canvas.width / cols
    let cellHeight = canvas.height / rows
    ctx.fillStyle = 'green'
    ctx.fillRect(
      col * cellWidth,
      row * cellHeight,
      cellWidth,
      cellHeight
    )
  }

  shuffleApples() {
    let row = randInt(0, this.rows)
    let col = randInt(0, this.cols)
    this.apples.unshift(new Apple(this, row, col))

    this.broadcast('createApple', { row, col })

    if(this.apples.length > this.targetApples) {
      this.removeApple(0)
    }
  }

  removeApple(index) {
    let { row, col } = this.apples[index]
    this.broadcast('deleteApple', { row, col })
    this.apples.splice(index, 1)
  }

  run() {
    this.ctx.beginPath()
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    for(let controller of this.controllers) {
      if(!controller.run()) {
        this.broadcast('deletePlayer', this.playerId)
        alert('game over sucka')
        window.clearInterval(this.intervalId)
        return
      }
    }

    for(let snake of this.snakes) {
      snake.draw()
    }
    for(let apple of this.apples) {
      apple.draw()
    }

    if(Math.random() < 0.05 / this.snakes.length) {
      this.shuffleApples()
    }
  }
}

class Comm {
  constructor(ws) {
    this.ws = ws
    this.listeners = []
    
    this.ws.onmessage = evt => {
      let {verb, data} = JSON.parse(evt.data)
      for(let listener of this.listeners) {
        listener(verb, data)
      }
    }
  }

  addListener(listener) {
    this.listeners.push(listener)
  }

  broadcast(verb, data) {
    this.ws.send(JSON.stringify({ verb, data }))
  }
}

function connectWebsocket(url, callback) {
  let ws = new WebSocket(url)
  ws.onopen = () => {
    callback(new Comm(ws))
  }
}

function main() {
  var wsUrl = new URL('/ws', window.location.href)
  wsUrl.protocol = wsUrl.protocol.replace('http', 'ws')

  connectWebsocket(wsUrl.href, (comm, err) => {
    let game = new Game(comm, document.getElementById('game-canvas'), 30, 40)
    let snake = new Snake(game)
    let controller = new SnakeController(snake, randInt(0, 30), randInt(0, 40), RIGHT, 4)
  })
}
