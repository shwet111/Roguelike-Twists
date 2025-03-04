// MainScene.js
class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
  }

  preload() {
    // Load assets – replace with your own asset paths.
    this.load.image('tiles', 'assets/tiles.png'); // Tileset image for the level.
    this.load.spritesheet('player', 'assets/player.png', { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet('enemy', 'assets/enemy.png', { frameWidth: 32, frameHeight: 32 });
    this.load.audio('bgm', 'assets/chiptune.mp3');
  }

  create() {
    // Play background music
    this.sound.add('bgm', { volume: 0.5, loop: true }).play();

    // Create a procedural level using preset segments
    this.createProceduralLevel();

    // Create player at starting position
    this.player = new Player(this, 100, 400);
    this.add.existing(this.player);
    this.physics.add.existing(this.player);
    this.player.setCollideWorldBounds(true);

    // Set camera to follow the player
    this.cameras.main.startFollow(this.player);

    // Create enemy group and add one enemy per segment
    this.enemies = this.physics.add.group();
    this.createEnemies();

    // Set collisions between player, enemies, and ground layer
    this.physics.add.collider(this.player, this.groundLayer);
    this.physics.add.collider(this.enemies, this.groundLayer);
    this.physics.add.overlap(this.player, this.enemies, this.handlePlayerEnemyCollision, null, this);

    // Input keys
    this.cursors = this.input.keyboard.createCursorKeys();

    // Display narrative text (simple backstory)
    this.add.text(20, 20, "Once a celebrated hero, our protagonist ventures into a cursed dungeon to reclaim a lost relic.", { font: "16px Arial", fill: "#ffffff" })
      .setScrollFactor(0);
  }

  update(time, delta) {
    // Update player controller with input
    this.player.update(this.cursors);

    // Update each enemy based on the player's current position
    this.enemies.children.iterate(enemy => {
      enemy.update(this.player);
    });

    // Check for level completion (player reaches end of level)
    if (this.player.x > this.levelWidth - 50) {
      console.log("Level Complete! New ability unlocked: Double Jump");
      // Transition to next level or apply progression logic.
    }
  }

  createProceduralLevel() {
    // Define level dimensions in tiles
    const mapWidth = 50; // 50 tiles wide
    const mapHeight = 20; // 20 tiles high
    this.levelWidth = mapWidth * 32;

    // Create a blank tilemap
    const map = this.make.tilemap({ width: mapWidth, height: mapHeight, tileWidth: 32, tileHeight: 32 });
    const tileset = map.addTilesetImage('tiles');
    this.groundLayer = map.createBlankLayer("Ground", tileset, 0, 0);

    // Fill bottom row with ground (tile index 1)
    for (let x = 0; x < mapWidth; x++) {
      map.putTileAt(1, x, mapHeight - 1, true, this.groundLayer);
    }

    // Define preset segments (each segment is 10 tiles wide)
    const segments = [
      { // Segment A: flat ground with two platforms
        platforms: [
          { x: 2, y: 15, width: 4 },
          { x: 6, y: 12, width: 3 }
        ]
      },
      { // Segment B: uneven ground with one long platform
        platforms: [
          { x: 0, y: 17, width: 10 },
          { x: 4, y: 14, width: 3 }
        ]
      },
      { // Segment C: gap and a higher platform
        platforms: [
          { x: 0, y: 17, width: 4 },
          { x: 6, y: 13, width: 4 }
        ]
      }
    ];

    // Use segments to fill the level horizontally
    const segmentWidth = 10;
    const numSegments = Math.floor(mapWidth / segmentWidth);
    for (let seg = 0; seg < numSegments; seg++) {
      const preset = Phaser.Utils.Array.GetRandom(segments);
      if (preset.platforms) {
        preset.platforms.forEach(platform => {
          const absX = seg * segmentWidth + platform.x;
          for (let x = absX; x < absX + platform.width; x++) {
            map.putTileAt(1, x, platform.y, true, this.groundLayer);
          }
        });
      }
    }
    // Enable collision on ground tile (index 1)
    this.groundLayer.setCollision(1);
  }

  createEnemies() {
    // Spawn one enemy per segment at random positions within each segment
    const segmentPixelWidth = 10 * 32; // each segment is 10 tiles wide at 32px per tile
    const numSegments = Math.floor(this.levelWidth / segmentPixelWidth);
    for (let seg = 0; seg < numSegments; seg++) {
      // Randomly choose an enemy type: patrol, jumping, or chasing
      const enemyType = Phaser.Utils.Array.GetRandom(['patrol', 'jumping', 'chasing']);
      const x = seg * segmentPixelWidth + Phaser.Math.Between(50, segmentPixelWidth - 50);
      // Place enemy slightly above ground level (assuming ground is near the bottom)
      const y = (20 - 2) * 32;
      let enemy;
      if (enemyType === 'patrol') {
        enemy = new PatrolEnemy(this, x, y);
      } else if (enemyType === 'jumping') {
        enemy = new JumpingEnemy(this, x, y);
      } else if (enemyType === 'chasing') {
        enemy = new ChasingEnemy(this, x, y);
      }
      this.enemies.add(enemy);
    }
  }

  handlePlayerEnemyCollision(player, enemy) {
    console.log("Player hit an enemy!");
    player.takeDamage();
  }
}

// Player class: handles movement, jumping, crouching, and basic progression logic.
class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player');
    this.speed = 200;
    this.jumpSpeed = -350;
    this.isCrouching = false;
    this.hasDoubleJump = false; // unlocked upon level completion
    this.canDoubleJump = false;
    this.health = 3;

    // Create animations (using frames from the spritesheet)
    if (!scene.anims.exists('walk')) {
      scene.anims.create({
        key: 'walk',
        frames: scene.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
      });
    }
    if (!scene.anims.exists('idle')) {
      scene.anims.create({
        key: 'idle',
        frames: [{ key: 'player', frame: 0 }],
        frameRate: 10
      });
    }
    if (!scene.anims.exists('crouch')) {
      scene.anims.create({
        key: 'crouch',
        frames: [{ key: 'player', frame: 4 }], // assume frame 4 is a crouch frame
        frameRate: 10
      });
    }
  }

  update(cursors) {
    // Horizontal movement
    if (cursors.left.isDown) {
      this.setVelocityX(-this.speed);
      this.flipX = true;
      this.anims.play('walk', true);
    } else if (cursors.right.isDown) {
      this.setVelocityX(this.speed);
      this.flipX = false;
      this.anims.play('walk', true);
    } else {
      this.setVelocityX(0);
      this.anims.play(this.isCrouching ? 'crouch' : 'idle', true);
    }

    // Crouching: when down arrow is held
    this.isCrouching = cursors.down.isDown;

    // Jumping: support normal jump and double jump (if unlocked)
    if (Phaser.Input.Keyboard.JustDown(cursors.up)) {
      if (this.body.onFloor()) {
        this.setVelocityY(this.jumpSpeed);
        this.canDoubleJump = true;
      } else if (this.canDoubleJump && this.hasDoubleJump) {
        this.setVelocityY(this.jumpSpeed);
        this.canDoubleJump = false;
      }
    }
  }

  takeDamage() {
    this.health--;
    console.log("Player health:", this.health);
    if (this.health <= 0) {
      // Restart level on death
      this.scene.scene.restart();
    } else {
      // Reset position as a damage penalty
      this.setPosition(100, 400);
    }
  }
}

// Base Enemy class
class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture = 'enemy') {
    super(scene, x, y, texture);
    this.scene = scene;
    this.speed = 100;
    this.setCollideWorldBounds(true);
  }
  
  update(player) {
    // Base enemy does nothing – to be overridden by subclasses.
  }
}

// PatrolEnemy: moves back and forth within a set range.
class PatrolEnemy extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y);
    this.direction = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
    this.setVelocityX(this.speed * this.direction);
    this.patrolRange = 100;
    this.startX = x;
  }
  
  update(player) {
    if (this.x < this.startX - this.patrolRange) {
      this.direction = 1;
      this.setVelocityX(this.speed * this.direction);
      this.flipX = false;
    } else if (this.x > this.startX + this.patrolRange) {
      this.direction = -1;
      this.setVelocityX(this.speed * this.direction);
      this.flipX = true;
    }
  }
}

// JumpingEnemy: periodically jumps when on the ground.
class JumpingEnemy extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y);
    this.jumpTimer = 0;
    this.jumpInterval = Phaser.Math.Between(2000, 4000); // in milliseconds
  }
  
  update(player) {
    this.jumpTimer += this.scene.game.loop.delta;
    if (this.jumpTimer > this.jumpInterval && this.body.onFloor()) {
      this.setVelocityY(-200);
      this.jumpTimer = 0;
    }
  }
}

// ChasingEnemy: chases the player if within a certain range.
class ChasingEnemy extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y);
    this.chaseRange = 150;
  }
  
  update(player) {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    if (distance < this.chaseRange) {
      if (player.x < this.x) {
        this.setVelocityX(-this.speed);
        this.flipX = true;
      } else {
        this.setVelocityX(this.speed);
        this.flipX = false;
      }
    } else {
      this.setVelocityX(0);
    }
  }
}

// Game configuration and initialization
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'gameContainer',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 600 },
      debug: false
    }
  },
  scene: MainScene
};

const game = new Phaser.Game(config);
