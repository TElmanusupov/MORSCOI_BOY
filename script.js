/*
 * МОРСКОЙ БОЙ
 * Архитектура: MVC
 * Model      -> Ship, Board, Game
 * View       -> DOMRenderer
 * Controller -> GameController
 *
 * Паттерн Factory:
 * ShipFactory создаёт корабли из единого описания флота.
 */

// ==================== MODEL ====================

class Ship {
  constructor(name, size) {
    this.name = name;
    this.size = size;
    this.hits = 0;
    this.cells = [];
  }

  hit() {
    if (this.hits < this.size) this.hits++;
  }

  isSunk() {
    return this.hits >= this.size;
  }
}

class ShipFactory {
  static createFleet() {
    const fleet = [
      ["Линкор", 4],
      ["Крейсер", 3],
      ["Крейсер", 3],
      ["Эсминец", 2],
      ["Эсминец", 2],
      ["Эсминец", 2]
    ];
    return fleet.map(([name, size]) => new Ship(name, size));
  }
}

class Board {
  constructor(size = 10) {
    this.size = size;
    this.cells = Array.from({ length: size }, () =>
      Array(size).fill(null)
    );
    this.shots = Array.from({ length: size }, () =>
      Array(size).fill("empty")
    );
    this.ships = [];
  }

  inBounds(r, c) {
    return r >= 0 && r < this.size && c >= 0 && c < this.size;
  }

  canPlace(r, c, length, horizontal) {
    for (let i = 0; i < length; i++) {
      const rr = r + (horizontal ? 0 : i);
      const cc = c + (horizontal ? i : 0);

      if (!this.inBounds(rr, cc) || this.cells[rr][cc]) return false;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = rr + dr, nc = cc + dc;
          if (this.inBounds(nr, nc) && this.cells[nr][nc]) return false;
        }
      }
    }
    return true;
  }

  placeShip(ship, r, c, horizontal) {
    if (!this.canPlace(r, c, ship.size, horizontal)) return false;

    ship.cells = [];
    for (let i = 0; i < ship.size; i++) {
      const rr = r + (horizontal ? 0 : i);
      const cc = c + (horizontal ? i : 0);
      this.cells[rr][cc] = ship;
      ship.cells.push([rr, cc]);
    }

    this.ships.push(ship);
    return true;
  }

  randomizeFleet() {
    this.cells = Array.from({ length: this.size }, () =>
      Array(this.size).fill(null)
    );
    this.ships = [];

    for (const ship of ShipFactory.createFleet()) {
      let placed = false;
      while (!placed) {
        const r = Math.floor(Math.random() * this.size);
        const c = Math.floor(Math.random() * this.size);
        const horizontal = Math.random() > 0.5;
        placed = this.placeShip(ship, r, c, horizontal);
      }
    }
  }

  receiveShot(r, c) {
    if (!this.inBounds(r, c) || this.shots[r][c] !== "empty") {
      return { valid: false };
    }

    const ship = this.cells[r][c];
    if (!ship) {
      this.shots[r][c] = "miss";
      return { valid: true, hit: false };
    }

    ship.hit();
    this.shots[r][c] = ship.isSunk() ? "sunk" : "hit";

    return {
      valid: true,
      hit: true,
      sunk: ship.isSunk(),
      ship
    };
  }

  allSunk() {
    return this.ships.every(ship => ship.isSunk());
  }

  remainingShips() {
    return this.ships.filter(ship => !ship.isSunk()).length;
  }
}

class Game {
  constructor() {
    this.reset();
  }

  reset() {
    this.player = new Board();
    this.enemy = new Board();
    this.player.randomizeFleet();
    this.enemy.randomizeFleet();
    this.turn = "player";
    this.over = false;
    this.computerTargets = [];
  }

  playerShoot(r, c) {
    if (this.over || this.turn !== "player") return null;

    const result = this.enemy.receiveShot(r, c);
    if (!result.valid) return null;

    if (this.enemy.allSunk()) {
      this.over = true;
      return { ...result, winner: "player" };
    }

    // Попадание даёт дополнительный выстрел.
    if (!result.hit) this.turn = "computer";
    return result;
  }

  computerShoot() {
    if (this.over || this.turn !== "computer") return null;

    let target;
    while (this.computerTargets.length) {
      const candidate = this.computerTargets.shift();
      if (this.player.shots[candidate[0]][candidate[1]] === "empty") {
        target = candidate;
        break;
      }
    }

    if (!target) {
      const free = [];
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
          if (this.player.shots[r][c] === "empty") free.push([r, c]);
        }
      }
      target = free[Math.floor(Math.random() * free.length)];
    }

    const [r, c] = target;
    const result = this.player.receiveShot(r, c);

    if (result.hit && !result.sunk) {
      const directions = [[1,0],[-1,0],[0,1],[0,-1]];
      for (const [dr, dc] of directions) {
        const nr = r + dr, nc = c + dc;
        if (this.player.inBounds(nr, nc) &&
            this.player.shots[nr][nc] === "empty") {
          this.computerTargets.push([nr, nc]);
        }
      }
    }

    if (this.player.allSunk()) {
      this.over = true;
      return { ...result, winner: "computer" };
    }

    // Компьютер стреляет ещё раз при попадании.
    if (!result.hit) this.turn = "player";
    return result;
  }
}

// ==================== VIEW ====================

class DOMRenderer {
  constructor(game) {
    this.game = game;
    this.playerBoard = document.getElementById("playerBoard");
    this.enemyBoard = document.getElementById("enemyBoard");
    this.status = document.getElementById("status");
    this.playerShips = document.getElementById("playerShips");
    this.enemyShips = document.getElementById("enemyShips");
  }

  render() {
    this.renderBoard(this.playerBoard, this.game.player, true);
    this.renderBoard(this.enemyBoard, this.game.enemy, false);

    this.playerShips.textContent = this.game.player.remainingShips();
    this.enemyShips.textContent = this.game.enemy.remainingShips();

    if (this.game.over) {
      this.status.textContent =
        this.game.player.allSunk() ? "💀 Ты проиграл!" : "🏆 Ты победил!";
    } else {
      this.status.textContent =
        this.game.turn === "player" ? "🎯 Твой ход" : "🤖 Ход компьютера";
    }
  }

  renderBoard(element, board, ownBoard) {
    element.innerHTML = "";

    for (let r = 0; r < board.size; r++) {
      for (let c = 0; c < board.size; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";

        const state = board.shots[r][c];
        const ship = board.cells[r][c];

        if (state === "hit") cell.classList.add("hit");
        if (state === "miss") cell.classList.add("miss");
        if (state === "sunk") cell.classList.add("sunk");

        if (ownBoard && ship && state === "empty") {
          cell.classList.add("ship");
        }

        cell.dataset.row = r;
        cell.dataset.col = c;
        element.appendChild(cell);
      }
    }
  }
}

// ==================== CONTROLLER ====================

class GameController {
  constructor() {
    this.game = new Game();
    this.view = new DOMRenderer(this.game);

    document.getElementById("newGameBtn")
      .addEventListener("click", () => this.newGame());

    document.getElementById("enemyBoard")
      .addEventListener("click", e => this.handlePlayerShot(e));

    this.view.render();
  }

  newGame() {
    this.game.reset();
    this.view.render();
  }

  handlePlayerShot(e) {
    const cell = e.target.closest(".cell");
    if (!cell) return;

    const r = Number(cell.dataset.row);
    const c = Number(cell.dataset.col);

    const result = this.game.playerShoot(r, c);
    if (!result) return;

    this.view.render();

    if (this.game.over) return;

    // При попадании игрок сохраняет ход.
    if (result.hit) return;

    this.computerTurn();
  }

  computerTurn() {
    if (this.game.over) return;

    setTimeout(() => {
      const result = this.game.computerShoot();
      this.view.render();

      if (!this.game.over && result?.hit) {
        this.computerTurn();
      }
    }, 550);
  }
}

new GameController();
