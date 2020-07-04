let gl = c.getContext('webgl', {
  preserveDrawingBuffer: true
}),
  w = c.width = window.innerWidth,
  h = c.height = window.innerHeight,
  webgl = {},
  opts = {
    projectileAlpha: 1.,
    projectileLineWidth: 2,
    fireworkAngleSpan: .5,
    baseFireworkVel: 3.5,
    addedFireworkVel: 6.5,
    gravity: .05,
    lowVelBoundary: -.2,
    xFriction: .995,
    baseShardVel: 1,
    addedShardVel: 1.2,
    fireworks: 1000,
    baseShardsParFirework: 10,
    addedShardsParFirework: 10,
    shardFireworkVelMultiplier: .6,
    initHueMultiplier: 1 / 360,
    runHueAdder: .1 / 360
  }

webgl.vertexShaderSource = vertex_shader_source.textContent
webgl.fragmentShaderSource = fragment_shader_source.textContent

webgl.vertexShader = gl.createShader(gl.VERTEX_SHADER)
gl.shaderSource(webgl.vertexShader, webgl.vertexShaderSource)
gl.compileShader(webgl.vertexShader)

webgl.fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
gl.shaderSource(webgl.fragmentShader, webgl.fragmentShaderSource)
gl.compileShader(webgl.fragmentShader)

webgl.shaderProgram = gl.createProgram()
gl.attachShader(webgl.shaderProgram, webgl.vertexShader)
gl.attachShader(webgl.shaderProgram, webgl.fragmentShader)

gl.linkProgram(webgl.shaderProgram)
gl.useProgram(webgl.shaderProgram)

webgl.dataAttribLoc = gl.getAttribLocation(webgl.shaderProgram, 'a_data')
webgl.dataBuffer = gl.createBuffer()

gl.enableVertexAttribArray(webgl.dataAttribLoc)
gl.bindBuffer(gl.ARRAY_BUFFER, webgl.dataBuffer)
gl.vertexAttribPointer(webgl.dataAttribLoc, 4, gl.FLOAT, false, 0, 0)

webgl.resUniformLoc = gl.getUniformLocation(webgl.shaderProgram, 'u_res')
webgl.modeUniformLoc = gl.getUniformLocation(webgl.shaderProgram, 'u_mode')

gl.viewport(0, 0, w, h)
gl.uniform2f(webgl.resUniformLoc, w, h)

gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
gl.enable(gl.BLEND)

gl.lineWidth(opts.projectileLineWidth)

webgl.data = []

webgl.clear = function () {
  gl.uniform1i(webgl.modeUniformLoc, 1);
  let a = .1
  webgl.data = [
    -1, -1, 0, a,
    1, -1, 0, a,
    -1, 1, 0, a,
    -1, 1, 0, a,
    1, -1, 0, a,
    1, 1, 0, a
  ]
  webgl.draw(gl.TRIANGLES);
  gl.uniform1i(webgl.modeUniformLoc, 0);
  webgl.data.length = 0;
}

webgl.draw = function (glType) {
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(webgl.data), gl.STATIC_DRAW);
  gl.drawArrays(glType, 0, webgl.data.length / 4);
}

let fireworks = [],
  tick = 0,
  sins = [],
  coss = [],
  maxShardsParFirework = opts.baseShardsParFirework + opts.addedShardsParFirework,
  tau = 6.283185307179586476925286766559;

for (var i = 0; i < maxShardsParFirework; ++i) {
  sins[i] = Math.sin(tau * i / maxShardsParFirework);
  coss[i] = Math.cos(tau * i / maxShardsParFirework);
}

class Firework {
  constructor() {
    this.reset()
    this.shards = []
    for (var i = 0; i < maxShardsParFirework; ++i)
      this.shards.push(new Shard(this))
  }
  reset() {
    var angle = -Math.PI / 2 + (Math.random() - .5) * opts.fireworkAngleSpan, vel = opts.baseFireworkVel + opts.addedFireworkVel * Math.random()
    this.mode = 0
    this.vx = vel * Math.cos(angle)
    this.vy = vel * Math.sin(angle)
    this.x = Math.random() * w
    this.y = h
    this.hue = tick * opts.initHueMultiplier
  }
  step(deltaTime) {
    if (this.mode === 0) {
      let px = this.x,
        py = this.y,
        ph = this.hue
      this.hue += opts.runHueAdder
      this.x += deltaTime * (this.vx *= opts.xFriction)
      this.y += deltaTime * (this.vy += opts.gravity)
      webgl.data.push(
        px, py, ph, opts.projectileAlpha * .2,
        this.x, this.y, this.hue, opts.projectileAlpha * .2)
      if (this.vy >= opts.lowVelBoundary) {
        this.mode = 1
        this.shardAmount = opts.baseShardsParFirework + opts.addedShardsParFirework * Math.random() | 0
        let baseAngle = Math.random() * tau, x = Math.cos(baseAngle), y = Math.sin(baseAngle), sin = sins[this.shardAmount], cos = coss[this.shardAmount]
        for (let i = 0; i < this.shardAmount; ++i) {
          let vel = opts.baseShardVel + opts.addedShardVel * Math.random()
          this.shards[i].reset(x * vel, y * vel)
          let X = x
          x = x * cos - y * sin
          y = y * cos + X * sin
        }
      }
    } else if (this.mode === 1) {
      this.ph = this.hue
      this.hue += opts.runHueAdder
      let allDead = true
      for (let i = 0; i < this.shardAmount; ++i) {
        let shard = this.shards[i]
        if (!shard.dead) {
          shard.step(deltaTime)
          allDead = false
        }
      }
      if (allDead)
        this.reset()
    }
  }
}

class Shard {
  constructor(rocket) {
    this.rocket = rocket
  }
  reset(vx, vy) {
    this.x = this.rocket.x
    this.y = this.rocket.y
    this.vx = this.rocket.vx * opts.shardFireworkVelMultiplier + vx
    this.vy = this.rocket.vy * opts.shardFireworkVelMultiplier + vy
    this.starty = this.y
    this.dead = false
    this.tick = 0
  }
  step(deltaTime) {
    this.tick += .01
    let px = this.x, py = this.y
    this.x += deltaTime * (this.vx *= opts.xFriction)
    this.y += deltaTime * (this.vy += opts.gravity)
    let lineAlpha = opts.projectileAlpha - this.tick
    // lineAlpha = lineAlpha > 0.4 ? lineAlpha : 0
    webgl.data.push(px, py, this.rocket.ph, lineAlpha, this.x, this.y, this.rocket.hue, lineAlpha)
    if (this.y > h)
      this.dead = true
  }
}

let then = 0;
let run = (now) => {
  now *= 0.1;
  const deltaTime = now - then;
  then = now;
  webgl.clear();
  ++tick;
  if (fireworks.length < opts.fireworks)
    fireworks.push(new Firework);
  fireworks.map(firework => {
    firework.step(deltaTime);
  });
  webgl.draw(gl.LINES);
  window.requestAnimationFrame(run)
}

window.requestAnimationFrame(run)

window.addEventListener('resize', () => {
  w = c.width = window.innerWidth
  h = c.height = window.innerHeight
  gl.viewport(0, 0, w, h)
  gl.uniform2f(webgl.resUniformLoc, w, h)
})

window.addEventListener('click', e => {
  let firework = new Firework()
  firework.x = e.clientX
  firework.y = e.clientY
  firework.vy = firework.vx = 0
  fireworks.push(firework)
})

