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
    snake.currentDir = initDir
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
    this.snake.currentDir = dir
  }


  run() {
    let game = this.snake.game

    let { row, col } = this.snake.segments[0]
    let newRow = row + dRow[this.snake.currentDir]
    let newCol = col + dCol[this.snake.currentDir]

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

    // ate an advice
    let adviceIndex = game.advices.findIndex(sameAsNewSeg)
    if (adviceIndex >= 0) {
      this.targetLength += 1
      let advice = game.advices[adviceIndex]
      advice.getEaten(adviceIndex)
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
  constructor(game, imagePath, initDir, playerId) {
    this.game = game
    this.playerId = playerId || this.game.playerId
    this.segments = []

    this.face = new Image(40, 40)
    this.face.src = imagePath;
    this.currentDir = null;
    document.getElementById("animations-box").appendChild(this.face)

    game.snakes.push(this)
  }

  draw() {
    for (let segment of this.segments) {
      this.game.drawSegment(segment.row, segment.col)
    }
    this.drawFace();
  }

  broadcastSelf() {
    this.game.broadcast('updateSnake', {
      playerId: this.playerId,
      currentDir: this.currentDir,
      segments: this.segments
    })
  }

  update(data) {
    this.segments = data.segments
    this.currentDir = data.currentDir
  }

  drawFace() {
    let cellWidth = this.game.canvas.width / this.game.cols;
    let cellHeight = this.game.canvas.height / this.game.rows;
    TweenLite.to(this.face, .01, { left: (this.segments[0].col * cellWidth) - 10, top: (this.segments[0].row * cellHeight) - 10 })
    let rotation;
    switch(this.currentDir) {
      case UP: rotation = -90; break
      case DOWN: rotation = 90; break
      case LEFT: rotation = 180; break
      case RIGHT: rotation = 0; break
    }
    TweenLite.to(this.face, 0.01, {rotation, transformOrigin:"50% 50%"});
  }
}

class Advice {
  constructor(game, row, col) {
    this.game = game;
    this.row = row;
    this.col = col;
    this.getAdvice();
    this.text = "";
    this.tl = new TimelineLite;
    this.icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    this.use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', "#seed");
    this.icon.classList.add('advice-icon')
    this.icon.append(this.use);
    document.getElementById("animations-box").append(this.icon);
    this.tl.to(this.icon, .01, { left: (this.col * this.game.cellWidth) - 5, top: (this.row * this.game.cellHeight) - 5 })
  }

  getAdvice() {
    fetch('https://api.adviceslip.com/advice')
    .then(response => {
      return response.json()
    } )
    .then( data => this.text = data.slip.advice )
   
  }

  getEaten(adviceIndex) {
    this.game.updateAdvice(this.text)
    this.game.advices.splice(adviceIndex, 1)
    this.tl.to(this.icon, .5, { top: 30, right: 30, left: 'auto' })
      .to(this.icon, 1, { opacity: 0 })
      
  }

  remove() {
    TweenLite.to(this.icon, 1, { opacity: 0 })
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
    this.advices = []

    this.targetAdvices = 5

    this.playerId = randGuid()
    this.comm.addListener((verb, data) => this.receive(verb, data))

    this.broadcast('createPlayer', this.playerId)

    this.intervalId = window.setInterval(() => this.run(), 500)

    this.currentAdvice = "";
    this.cellWidth = this.canvas.width / this.cols;
    this.cellHeight = this.canvas.height / this.rows;
    this.adviceContainer = document.getElementById("advice-container");
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
      case 'updateAdvices':
        this.updateRemoteAdvices(data)
        break
      case 'deleteAdvice':
        this.deleteRemoteAdvice(data)
        break
    }
  }

  createRemotePlayer(playerId) {
    let snakeIndex = this.snakes.findIndex(x => x.playerId === playerId)
    if(snakeIndex === -1) {
      console.log('MAKE')
      new Snake(this, "./marc.jpeg", RIGHT, playerId)
      this.broadcast('createPlayer', this.playerId)
      for(let advice of this.advices) {
        this.broadcast('updateAdvices', this.advices.map(a => ({ row: a.row, col: a.col })))
      }
    }
  }

  deleteRemotePlayer(playerId) {
    let snakeIndex = this.snakes.findIndex(x => x.playerId === playerId)
    if(snakeIndex >= 0) {
      this.snakes.splice(snakeIndex, 1)
    }
    console.log(this.snakes)
  }

  updateRemoteSnake(data) {
    let snake = this.snakes.find(x => x.playerId === data.playerId)
    if(!snake) {
      return
    }

    snake.update(data)
  }

  updateRemoteAdvices(data) {
    this.advices = data.map(x => new Advice(this, x.row, x.col))
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

  drawImage(image, row, col, width, height) {
    let { ctx, canvas, cols, rows } = this
    let cellWidth = canvas.width / cols
    let cellHeight = canvas.height / rows
    this.ctx.drawImage(
      image,
      col * cellWidth,
      row * cellHeight,
      width || cellWidth,
      height || cellHeight
    )
  }

  updateAdvice(advice) {
    let tl = new TimelineLite;
    this.advice = advice
    this.adviceContainer.innerHTML = advice
    tl.from(this.adviceContainer, .5, { opacity: 0 })
      .to(this.adviceContainer, .5, { opacity: 1 })
      .to(this.adviceContainer, 5, { opacity: 0 })
    
  }

  shuffleAdvices() {
    let row = randInt(0, this.rows)
    let col = randInt(0, this.cols)
    this.advices.unshift(new Advice(this, row, col))

    this.broadcast('updateAdvices', this.advices.map(a => ({ row: a.row, col: a.col })))

    if (this.advices.length > this.targetAdvices) {
      this.advices[this.advices.length - 1].remove();
      this.advices.pop()
    }
  }

  removeAdvice(index) {
    let { row, col } = this.advices[index]
    this.advices.splice(index, 1)
    this.broadcast('updateAdvices', this.advices.map(a => ({ row: a.row, col: a.col })))
  }

  run() {
    this.ctx.beginPath()
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    for(let controller of this.controllers) {
      if(!controller.run()) {
        this.broadcast('deletePlayer', this.playerId)
        alert('game over sucka')
        window.clearInterval(this.intervalId)
        this.comm.stop()
        return
      }
    }

    for(let snake of this.snakes) {
      snake.draw()
    }

    if(Math.random() < 0.05 / this.snakes.length) {
      this.shuffleAdvices()
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

  stop() {
    this.ws.close()
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
    let snake = new Snake(game, "./marc.jpeg", RIGHT)
    let controller = new SnakeController(snake, randInt(0, 30), randInt(0, 40), RIGHT, 4)
  })
}
