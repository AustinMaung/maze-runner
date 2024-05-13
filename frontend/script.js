//firebase stuff
let database = null
let isMakingMaze = false

//maze stuff
let mazeWidth = 0
let centerX = 0
let centerY = 0
let cols = 20
let rows = 20;
let w;
let grid = [];
let current;
let stack = [];

//game stuff
let players = {}
let player = null
let player_id = null
let playerNewPosition = null
let lastFrameCount = 0

let spawn = null
let goal = null
let isMazeRendered = false

function setup() {
	mazeWidth = Math.min(windowWidth, windowHeight) * 2/3
	w = floor(mazeWidth / rows)
	
	const firebaseConfig = {
		apiKey: "AIzaSyC62D-n_G2IuboD70IBPGI7luWW5E0xfAc",
		authDomain: "maze-runner-backend.firebaseapp.com",
		databaseURL: "https://maze-runner-backend-default-rtdb.firebaseio.com",
		projectId: "maze-runner-backend",
		storageBucket: "maze-runner-backend.appspot.com",
		messagingSenderId: "818398900199",
		appId: "1:818398900199:web:cece9c17f7f436580c1742"
	};

	const app = firebase.initializeApp(firebaseConfig);
	database = firebase.database()

	//load game if exist, else make new game
	let game = database.ref('game')
	game.once('value').then((snapshot) => {
		if (snapshot.exists()) {
			console.log('game exist')
			const data = snapshot.val()

			let gridData = data.grid
			grid = gridData.map(elem => {
				let cell = new Cell(elem.i, elem.j)
				cell.walls = elem.walls
				cell.show()
				return cell
			})

			spawn = grid.filter(obj => obj.i === data.spawn[0] && obj.j === data.spawn[1])[0]
			goal = grid.filter(obj => obj.i === data.goal[0] && obj.j === data.goal[1])[0]

			newUser(spawn)
			spawnPlayer(spawn, player_id)

			database.ref('game/master').once('value').then((snapshot) => {
				let master = snapshot.val()

				database.ref('users').once('value').then((snapshot) => {
					if (snapshot.exists() && !(master in snapshot.val())  ) {
						isMakingMaze = true
						resetGame()

						let gridData = grid.map(elem => ({
							'i': elem.i,
							'j': elem.j,
							'walls': elem.walls
						}))

						spawn = grid[Math.floor(Math.random() * grid.length)];
						do {
							goal = grid[Math.floor(Math.random() * grid.length)];
						} while (goal === spawn);

						database.ref('game').set({
							'spawn': [spawn.i, spawn.j],
							'goal': [goal.i, goal.j],
							'grid': gridData,
							'update': [current.i, current.j, -1, -1],
							'master': player_id
						})
					}
				})
			})
		} else {
			console.log('game doesnt exist')
			isMakingMaze = true
			resetGame()
			spawn = grid[Math.floor(Math.random() * grid.length)];
			do {
				goal = grid[Math.floor(Math.random() * grid.length)];
			} while (goal === spawn);

			newUser(spawn)
			spawnPlayer(spawn, player_id)

			let gridData = grid.map(elem => ({
				'i': elem.i,
				'j': elem.j,
				'walls': elem.walls
			}))

			game.set({
				'spawn': [spawn.i, spawn.j],
				'goal': [goal.i, goal.j],
				'grid': gridData,
				'update': [current.i, current.j, -1, -1],
				'master': player_id
			})
		}
	})

	function newUser(spawn) {
		let users = database.ref('users')
		let data = {
			'position': [spawn.i, spawn.j]
		}
		player_id = users.push(data).key

		users.child(player_id).onDisconnect().remove()
	}
	function spawnPlayer(spawn, id) {
		player = new Player(spawn)
		players[id] = player
	}

	const usersRef = database.ref('users');
	usersRef.on('value', (snapshot) => {
		const userObjects = snapshot.val();
		if (!userObjects) {
			return
		}

		const users = Object.keys(userObjects);
		users.forEach((key) => {
			if (key != player_id) {
				if (key in players) {
					players[key].current_position = grid.filter(obj => obj.i === userObjects[key]['position'][0] && obj.j === userObjects[key]['position'][1])[0]

				} else {
					otherPosition = grid.filter(obj => obj.i === userObjects[key]['position'][0] && obj.j === userObjects[key]['position'][0])[0]

					other = new Player(otherPosition)
					players[key] = other
				}
			}
		})
	})

	let update = database.ref('game/update')
	update.on('value', (snapshot) => {
		if (isMakingMaze || grid.length == 0) {
			return
		}

		const currentData = snapshot.val()
		current = grid.filter(obj => obj.i === currentData[0] && obj.j === currentData[1])[0]
		let next = grid.filter(obj => obj.i === currentData[2] && obj.j === currentData[3])[0]

		removeWalls(current, next)
	})

	let start = database.ref('game/start')
	start.on('value', (snapshot) => {
		isMazeRendered = snapshot.val()
	})

	let master = database.ref('game/master')
	master.on('value', (snapshot) => {
		if (snapshot.exists()) {
			game.once('value').then((snapshot) => {
				const data = snapshot.val()

				resetGame()

				let gridData = data.grid
				grid = gridData.map(elem => {
					let cell = new Cell(elem.i, elem.j)
					cell.walls = elem.walls
					cell.show()
					return cell
				})

				spawn = grid.filter(obj => obj.i === data.spawn[0] && obj.j === data.spawn[1])[0]
				goal = grid.filter(obj => obj.i === data.goal[0] && obj.j === data.goal[1])[0]

				player.current_position = spawn
				player.new_position = spawn
			})
		}
	})

	createCanvas(windowWidth, windowHeight);
}

function resetGame() {
	grid = []
	for (let j = 0; j < rows; j++) {
		for (let i = 0; i < cols; i++) {
			let cell = new Cell(i, j);
			grid.push(cell);
		}
	}

	current = grid[Math.floor(Math.random() * grid.length)];
}

function draw() {
	if(!player || !goal || !spawn) {
		return
	}

	background(51);
	frameRate(60)
	centerX = (windowWidth/2) - (mazeWidth/2)
	centerY = (windowHeight/2) - (mazeWidth/2)

	if (player.current_position == goal) {
		isMakingMaze = true
		isMazeRendered = false

		resetGame()
		spawn = grid[Math.floor(Math.random() * grid.length)];
		do {
			goal = grid[Math.floor(Math.random() * grid.length)];
		} while (goal === spawn);

		let gridData = grid.map(elem => ({
			'i': elem.i,
			'j': elem.j,
			'walls': elem.walls
		}))

		database.ref('game').set({
			'spawn': [spawn.i, spawn.j],
			'goal': [goal.i, goal.j],
			'grid': gridData,
			'update': [current.i, current.j, -1, -1],
			'start': false,
			'master': player_id
		})
	}
	
	if (isMakingMaze) {
		current.visited = true;

		let next = current.checkNeighbors();
		if (next) {
			next.visited = true;

			stack.push(current);

			removeWalls(current, next);

			//update cells in db
			database.ref('game/update').set([current.i, current.j, next.i, next.j])
			//change walls
			let currentIndex = current.j * rows + current.i
			database.ref('game/grid/'+currentIndex+'/walls').set(current.walls)
			let nextIndex = next.j * rows + next.i
			database.ref('game/grid/'+nextIndex+'/walls').set(next.walls)

			current = next;
		} else if (stack.length > 0) {
			current = stack.pop();
			current.highlight();
		} else {
			isMakingMaze = false
			isMazeRendered = true
			database.ref('game/start').set(true)
		}
	}
	
	if (isMazeRendered) {
		//main issue, interpolation happens between current and new position always, if change new position while interpolating,
		//            player teleports and interpolates between current and the 'new' new position. leads to gittering
		if (keyIsDown(87) && !player.current_position.walls[0]) {
		
			player.new_position = grid.filter(obj => obj.i === player.current_position.i && obj.j === player.current_position.j-1)[0]
			// console.log('87', player.new_position.i, player.new_position.j)
		}  else if (keyIsDown(65) && !player.current_position.walls[3]) {
			
			player.new_position = grid.filter(obj => obj.i === player.current_position.i-1 && obj.j === player.current_position.j)[0]
			// console.log('65', player.new_position.i, player.new_position.j)
		}  else if (keyIsDown(83) && !player.current_position.walls[2]) {
			
			player.new_position = grid.filter(obj => obj.i === player.current_position.i && obj.j === player.current_position.j+1)[0]
			// console.log('83', player.new_position.i, player.new_position.j)
		}  else if (keyIsDown(68) && !player.current_position.walls[1]) {
			
			player.new_position = grid.filter(obj => obj.i === player.current_position.i+1 && obj.j === player.current_position.j)[0]
			// console.log('68', player.new_position.i, player.new_position.j)
		} 
	}

	if (frameCount - lastFrameCount > 10) {
		lastFrameCount = frameCount;
		
		if (player.new_position) {
			player.current_position = player.new_position;
			database.ref('users/' + player_id + '/position').set([player.new_position.i, player.new_position.j])
		}
	} 
   
	if (player.current_position && player.new_position) {
		lerpX = lerp(((player.current_position.i * w)+centerX+(w/2)), ((player.new_position.i * w)+centerX+(w/2)), Math.abs((lastFrameCount-frameCount)/10))    
		lerpY = lerp(((player.current_position.j * w)+centerY+(w/2)), ((player.new_position.j * w)+centerY+(w/2)), Math.abs((lastFrameCount-frameCount)/10))
		
		player.actual_xy = [lerpX, lerpY] 
	}

	for (let i = 0; i < grid.length; i++) {
		grid[i].show();
	}

	let playersKeys = Object.keys(players)
	playersKeys.forEach((key) => {
		players[key].show()
	})
	player.show(true)

	noStroke()
	fill(0, 0, 255)
	circle((goal.i * w)+centerX+(w/2), (goal.j * w)+centerY+(w/2), w-3)
}

function keyPressed() {
	debounce = true
	lastFrameCount = frameCount
}

function index(i, j) {
	if (i < 0 || j < 0 || i > cols - 1 || j > rows - 1) {
		return -1;
	}
	return i + j * cols;
}

function removeWalls(a, b) {
	let x = a.i - b.i;
	if (x === 1) {
		a.walls[3] = false;
		b.walls[1] = false;
	} else if (x === -1) {
		a.walls[1] = false;
		b.walls[3] = false;
	}
	let y = a.j - b.j;
	if (y === 1) {
		a.walls[0] = false;
		b.walls[2] = false;
	} else if (y === -1) {
		a.walls[2] = false;
		b.walls[0] = false;
	}
}

function Cell(i, j) {
	this.i = i;
	this.j = j;
	this.walls = [true, true, true, true];
	this.visited = false;

	this.checkNeighbors = function() {
		let neighbors = [];

		let top = grid[index(i, j - 1)];
		let right = grid[index(i + 1, j)];
		let bottom = grid[index(i, j + 1)];
		let left = grid[index(i - 1, j)];

		if (top && !top.visited) {
			neighbors.push(top);
		}
		if (right && !right.visited) {
			neighbors.push(right);
		}
		if (bottom && !bottom.visited) {
			neighbors.push(bottom);
		}
		if (left && !left.visited) {
			neighbors.push(left);
		}

		if (neighbors.length > 0) {
			let r = floor(random(0, neighbors.length));
			return neighbors[r];
		} else {
			return undefined;
		}
	}   
	this.highlight = function() {
		let x = (this.i * w)+centerX;
		let y = (this.j * w)+centerY;

		noStroke();
		fill(0, 0, 255, 100);
		rect(x, y, w, w);
	}

	this.show = function() {
		let x = (this.i * w)+centerX;
		let y = (this.j * w)+centerY;
		stroke(255);
		if (this.walls[0]) {
			line(x, y, x + w, y);
		}
		if (this.walls[1]) {
			line(x + w, y, x + w, y + w);
		}
		if (this.walls[2]) {
			line(x + w, y + w, x, y + w);
		}
		if (this.walls[3]) {
			line(x, y + w, x, y);
		}
	}
}

function Player(cell) {
	this.current_position = cell;
	this.actual_xy = null
	this.new_position = null

	this.show = function(isPlayer) {
		noStroke()
		if (isPlayer) {
			fill(200, 100, 50)
		} else {
			fill(255, 0, 0)
		}
		
		if (this.current_position && !this.actual_xy) {  
			let x = (this.current_position.i * w)+centerX+(w/2);
			let y = (this.current_position.j * w)+centerY+(w/2);
			
			circle(x, y, w-3)
		} if (this.actual_xy) {
			circle(this.actual_xy[0], this.actual_xy[1], w-3)
		}
	}
}