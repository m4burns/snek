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

class SnakeController {
  constructor(snake, initRow, initCol, initDir, targetLength) {
    this.snake = snake
    snake.segments = [ { row: initRow, col: initCol } ]
    this.currentDir = initDir
    this.targetLength = targetLength

    document.addEventListener('keypress', evt => this.dispatch(evt))
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

    // ran into self
    if(this.snake.segments.find(sameAsNewSeg)) {
      return false
    }

    // ate an apple
    let appleIndex = game.apples.findIndex(sameAsNewSeg)
    if(appleIndex >= 0) {
      game.apples.splice(appleIndex, 1)
      this.targetLength += 1
    }

    this.snake.segments.unshift({ row: newRow, col: newCol })

    if(this.snake.segments.length > this.targetLength) {
      this.snake.segments.pop()
    }


    return true
  }
}

class Snake {
  constructor(game) {
    this.game = game
    this.segments = []
  }

  draw() {
    for(let segment of this.segments) {
      this.game.drawSegment(segment.row, segment.col)
    }
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
  constructor(canvas, rows, cols) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    this.rows = rows
    this.cols = cols

    this.snakes = []
    this.controllers = []
    this.apples = []

    this.targetApples = 5

    this.intervalId = window.setInterval(() => this.run(), 100)
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

    if(this.apples.length > this.targetApples) {
      this.apples.pop()
    }
  }

  run() {
    this.ctx.beginPath()
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    for(let controller of this.controllers) {
      if(!controller.run()) {
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

    if(Math.random() < 0.05) {
      this.shuffleApples()
    }
  }
}

function main() {
  let game = new Game(document.getElementById('game-canvas'), 30, 40)
  let snake = new Snake(game)
  let controller = new SnakeController(snake, 1, 1, RIGHT, 4)

  game.snakes.push(snake)
  game.controllers.push(controller)
}
