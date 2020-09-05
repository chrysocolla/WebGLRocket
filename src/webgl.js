// Stage维护WebGL上下文实例，管理顶点数据池和烟花对象池，并进行实际渲染逻辑;
class Stage {
  constructor(canvas, options) {
    // 注册画布DOM实例以及配置对象的引用;
    this.canvas = canvas
    this.options = options

    // 获取WebGL上下文;
    this.gl = this.canvas.getContext('webgl', { preserveDrawingBuffer: true })

    // 创建、注册、编译顶点着色器、片元着色器，并将其链接到程序上;
    this.vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER)
    this.fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER)
    this.gl.shaderSource(this.vertexShader, vertex_shader_source.textContent)
    this.gl.shaderSource(this.fragmentShader, fragment_shader_source.textContent)
    this.gl.compileShader(this.vertexShader)
    this.gl.compileShader(this.fragmentShader)

    this.shaderProgram = this.gl.createProgram()
    this.gl.attachShader(this.shaderProgram, this.vertexShader)
    this.gl.attachShader(this.shaderProgram, this.fragmentShader)

    this.gl.linkProgram(this.shaderProgram)
    this.gl.useProgram(this.shaderProgram)

    // 为属性和配置分配空间;
    this.locations = {
      a_data: this.gl.getAttribLocation(this.shaderProgram, 'a_data'),
      u_res: this.gl.getUniformLocation(this.shaderProgram, 'u_res'),
      u_mode: this.gl.getUniformLocation(this.shaderProgram, 'u_mode')
    }

    // 创建并绑定顶点数据缓冲区;
    this.dataBuffer = this.gl.createBuffer()
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.dataBuffer)
    this.gl.enableVertexAttribArray(this.locations.a_data)
    this.gl.vertexAttribPointer(this.locations.a_data, 4, this.gl.FLOAT, false, 0, 0)

    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA)
    this.gl.enable(this.gl.BLEND)

    // 设置线宽;
    // 注: 允许的线宽范围高度取决于平台实现，且标准要求平台实现的最小线宽最大值和
    // 最大线宽最小值均为1，故等于无效(例如在Windows下使用Direct技术实现);
    this.gl.lineWidth(this.options.projectileLineWidth)

    // 顶点数据池和烟花对象池;
    this.data = []
    this.rockets = []

    // 自增整数，用于改变色调;
    this.tick = 0

    // 创建并填充三角函数查找表，供分布烟花碎片使用;
    this.SIN = []
    this.COS = []
    for (var i = 0; i < this.options.maxShardsPerRocket; ++i) {
      this.SIN[i] = Math.sin(2 * Math.PI * i / this.options.maxShardsPerRocket)
      this.COS[i] = Math.cos(2 * Math.PI * i / this.options.maxShardsPerRocket)
    }

    // 初始化画布大小，使其铺满整个窗口并将分辨率信息更新至视口和分辨率参数中;
    this.w = this.canvas.width = window.innerWidth
    this.h = this.canvas.height = window.innerHeight
    this.gl.viewport(0, 0, this.w, this.h)
    this.gl.uniform2f(this.locations.u_res, this.w, this.h)

  }

  // 清除画布方法(在此实现烟花弹射物的尾迹)
  clear() {
    this.gl.uniform1i(this.locations.u_mode, 1) // 将顶点着色器模式设置为清除模式，不进行顶点转换;
    let a = this.options.projectileMask         // 令a为用于遮盖尾迹的遮罩alpha值;
    this.data = [                               // 画两个直角三角形填充满视口;
      -1, -1, 0, a,                             // 注: 在很多图形库的实现中，绘制三角形然后拼接的效率要
      1, -1, 0, a,                              //     高于直接绘制定价形式的矩形，推测此代码片段的原作
      -1, 1, 0, a,                              //     者在此处这样处理，仅是出于习惯的原因;
      -1, 1, 0, a,
      1, -1, 0, a,
      1, 1, 0, a
    ]
    this._draw(this.gl.TRIANGLES)               // 绘制顶点数据池中的数据，类型为三角形;
    this.gl.uniform1i(this.locations.u_mode, 0) // 将顶点着色器模式设置为清除模式，不进行顶点转换;
    this.data.length = 0                        // 将旧有数据取消标记以进行GC，避免内存泄漏;
  }

  // 更新画布方法(在此实现烟花正常燃放模拟逻辑)
  update(deltaTime) {                           // deltaTime为两次绘制间的时间，仅更新位置(简化计算);
    ++this.tick                                 // 增加计数器tick;
    if (this.rockets.length < this.options.rockets)
      this.rockets.push(new Rocket(this))       // 当烟花对象不足时，填充一个烟花;
    this.rockets.map(rocket => {
      rocket.step(deltaTime)                    // 更新全部烟花对象的状态;
    })
    this._draw(this.gl.LINES)                   // 绘制连线;
  }

  // 绘图方法(私有)，从顶点数据池中建立缓冲并进行绘制;
  _draw(glDrawType) {
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.data), this.gl.STATIC_DRAW)
    this.gl.drawArrays(glDrawType, 0, this.data.length / 4)
    /* 顶点数据池中单个数据结构(即a_data)见下:
    **  (x, y, hue, alpha);
    ** 
    **  其中:
    **  (x, y)被转化到屏幕空间;
    **  hue经由函数h2rgb，由色调转化为RGB颜色;
    **  alpha作为透明度直接传入;
    ** 
    **  详见#vertex_shader_source
    */
  }

}

// Rocket维护烟花弹射器的物理运动，并管理烟花碎片对象池;
class Rocket {
  constructor(stage) {
    this.stage = stage                          // 存储stage舞台实例;
    this.reset()                                // 重置状态到弹射器发射状态;
    this.shards = []                            // 建立烟花碎片对象池;
    for (var i = 0; i < this.stage.options.maxShardsPerRocket; ++i)
      this.shards.push(new Shard(this))         // 填充烟花碎片对象池;
  }

  // 状态重置方法;
  reset() {                                     // 初始化出射角度和速度;
    this.angle = -Math.PI / 2 + (Math.random() - .5) * this.stage.options.rocketAngleRange
    this.vel = this.stage.options.rocketBaseVel + this.stage.options.rocketExtraVel * Math.random()
    this.mode = 0                               // 模式设为0，代表是未爆炸时的弹射阶段;
    this.vx = this.vel * Math.cos(this.angle)   // 计算水平速度;
    this.vy = this.vel * Math.sin(this.angle)   // 计算竖直速度;
    this.x = Math.random() * this.stage.w       // 随机从任意水平地点出射;
    this.y = this.stage.h                       // 固定从底部出射;
    this.hue = this.stage.tick * this.stage.options.initHueMultiplier
  }                                             // 根据时间变化色调;

  // 状态更新方法(很简单，略);
  step(deltaTime) {
    if (this.mode === 0) {
      this.px = this.x
      this.py = this.y
      this.phue = this.hue
      this.hue += this.stage.options.runHueAdder
      this.x += deltaTime * (this.vx *= this.stage.options.xFriction)
      this.y += deltaTime * (this.vy += this.stage.options.gravity)
      this.stage.data.push(
        this.px, this.py, this.phue, this.stage.options.projectileAlpha,
        this.x, this.y, this.hue, this.stage.options.projectileAlpha
      )
      if (this.vy >= this.stage.options.lowVelBoundary) {
        this.mode = 1
        this.shardAmount = this.stage.options.baseShardsPerRocket + this.stage.options.extraShardsPerRocket * Math.random() | 0
        let baseAngle = Math.random() * Math.PI * 2,
          x = Math.cos(baseAngle),
          y = Math.sin(baseAngle),
          sin = this.stage.SIN[this.shardAmount],
          cos = this.stage.COS[this.shardAmount]
        for (let i = 0; i < this.shardAmount; ++i) {
          let vel = this.stage.options.shardBaseVel + this.stage.options.shardExtraVel * Math.random()
          this.shards[i].reset(x * vel, y * vel)
          let X = x
          x = x * cos - y * sin
          y = y * cos + X * sin
        }
      }
    } else if (this.mode === 1) {
      this.phue = this.hue
      this.hue += this.stage.options.runHueAdder
      this.allDead = true
      for (let i = 0; i < this.shardAmount; ++i) {
        let shard = this.shards[i]
        if (!shard.dead) {
          shard.step(deltaTime)
          this.allDead = false
        }
      }
      if (this.allDead)
        this.reset()
    }
  }
}

// Shard是烟花碎片对象，负责处理炸开的单个碎片爆炸运动和消亡过程(很简单，略);
class Shard {
  constructor(rocket) {
    this.rocket = rocket
  }
  reset(vx, vy) {
    this.px = this.x = this.rocket.x
    this.py = this.y = this.rocket.y
    this.vx = this.rocket.vx * this.rocket.stage.options.shardVelMultiplier + vx
    this.vy = this.rocket.vy * this.rocket.stage.options.shardVelMultiplier + vy
    this.dead = false
    this.lineAlpha = 1
  }
  step(deltaTime) {
    if (!this.dead) {
      this.lineAlpha -= .01
      if (this.lineAlpha < 0.05) {
        this.dead = true
      }
      this.px = this.x
      this.py = this.y
      this.x += deltaTime * (this.vx *= this.rocket.stage.options.xFriction)
      this.y += deltaTime * (this.vy += this.rocket.stage.options.gravity)
      this.rocket.stage.data.push(
        this.px, this.py, this.rocket.phue, this.lineAlpha,
        this.x, this.y, this.rocket.hue, this.lineAlpha
      )
    }
  }
}

// 配置选项
options = {
  // 数量配置:
  rockets: 500,               // 烟花数量;
  baseShardsPerRocket: 10,    // 单个烟花基础碎片数量;
  extraShardsPerRocket: 10,   // 单个烟花额外碎片数量;
  get maxShardsPerRocket() {  // 单个烟花最多碎片数量;
    return this.baseShardsPerRocket + this.extraShardsPerRocket
  },

  // 遮罩配置:
  projectileAlpha: .25,       // 弹射物Alpha值;
  projectileLineWidth: 2,     // 弹射物及碎片轨迹线宽;
  projectileMask: .1,         // 刷新使用的遮罩;

  // 色调配置:
  initHueMultiplier: 1 / 360, // 色调时间倍乘器;
  runHueAdder: .1 / 360,      // 色调递增器步长;

  // 弹射配置:
  rocketAngleRange: .5,       // 初始弹射角度范围;
  rocketBaseVel: 2.5,         // 初始弹射基础速度;
  rocketExtraVel: 10,         // 初始弹射额外速度;
  lowVelBoundary: -.4,        // 低速起爆阈值;

  // 碎片配置:
  shardBaseVel: 1,            // 初始碎片基础速度;
  shardExtraVel: 1.2,         // 初始碎片额外速度;
  shardVelMultiplier: .6,     // 弹射器速度继承值;

  // 速度配置:
  xFriction: .995,            // 水平方向速度衰减;
  gravity: .05                // 重力加速度;
}

const stage = new Stage(c, options)

let then = 0
function run(now) {
  now *= 0.1
  const deltaTime = now - then
  then = now
  stage.clear()
  stage.update(deltaTime)
  window.requestAnimationFrame(run)
}

window.requestAnimationFrame(run)

// 窗口大小变化事件钩子函数
function onResize(stage) {
  stage.w = stage.canvas.width = window.innerWidth
  stage.h = stage.canvas.height = window.innerHeight
  stage.gl.viewport(0, 0, stage.w, stage.h)
  stage.gl.uniform2f(stage.locations.u_res, stage.w, stage.h)
}

// 鼠标点击变化事件钩子函数
function onClick(e, stage) {
  let rocket = new Rocket(stage)
  rocket.x = e.clientX
  rocket.y = e.clientY
  rocket.vy = rocket.vx = 0
  stage.rockets.push(rocket)
}

// 进行窗口事件监听注册
window.addEventListener('resize', () => this.onResize(stage))
window.addEventListener('click', e => this.onClick(e, stage))