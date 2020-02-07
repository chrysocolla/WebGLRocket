# 烟花模拟粒子系统

## 概述 Summary

`WebGL`粗浅入门小练习，为了加深理解没有使用`Three.js`

(多年前瞎玩`Three.js`的我现在可算知道了我当时错过了啥)

实质上是对[这个](https://wow.techbrood.com/fiddle/32069)的修改和调整。

通过阅读注释可大致对`WebGL`的使用有一个大致的了解，包括但不限于:

- `WebGL`上下文;
- `GLSL`的基本概念;
- 以`OpenGL`为例的传统图形库渲染流程;
- 管理粒子系统的最佳实践;

## 目录结构及说明 Directories and Descriptions

``` shell
.
├── README.md                       # 说明文档
├── src                           # 代码
│   ├── webgl.js                    # webgl逻辑
│   └── webgl.old.js                # webgl逻辑(旧)
├── statics                       # 图片
│   ├── mask_color_horizontal.jpg   # 彩色横版
│   ├── mask_gliter_horizontal.jpg  # 金粉横板-启用
│   ├── mask_gliter_vertical.jpg    # 金粉竖版-启用
│   ├── mask_golden_horizontal.jpg  # 金色横板
│   └── mask_white_horizontal.jpg   # 白色横板
└── WebGLRocket.html                # 页面文件
```

`WebGLRocket.html`为页面文件:

- 使用`CSS`媒体查询选择图片遮罩;
- 使用`script`标签引入顶点着色器/片元着色器代码;

本项目内置的参数在Firefox 73浏览器中，1920*1080分辨率下基本能够达到烟花铺满屏幕，其他环境请自行玩耍;

理论上讲，同屏烟花数量的上限取决于你的内存有多少(不要玩过头啦)，因为渲染和计算实在是太简单了;

为了简化运算(实际上是我调好参数以后懒得改了)，有几处地方十分匪夷所思:

- 色调变化与更新次数相关联;
- 更新时间仅用于更新位置，速度的变化是以次数记的;
- 烟花炸裂后，每片碎片从弹射器处获得的动能，和分裂出的碎片数量对不上号;
- 烟花炸裂后，水平方向上有速度等比衰减;

如果你对这些奇怪的东西感到困惑和不满，请自行修改;

为得到不同的的显示和模拟效果，请编辑`webgl.js`文件修改参数,

也可使用类似于[dat.gui](https://github.com/dataarts/dat.gui)的工具进行动态调试，但需要对几个地方进行微调;

修改布局样式，请编辑`WebGLRocket.html`文件;

最后，祝平安健康，幸福喜乐。

武汉，加油！

## 截图 Screenshots

懒得截了
