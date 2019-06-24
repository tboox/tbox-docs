
## 准备工作

### 安装xmake

编译tbox源码，需要先安装[xmake](https://github.com/xmake-io/xmake)构建工具，因为整个tbox项目都是由xmake这个跨平台的构建工具维护的。

关于如何安装xmake，可以看下：[xmake安装文档](https://xmake.io/#/zh-cn/guide/installation)

里面讲的非常详细，当然通常情况下，下面的安装方式基本上已经可以满足大部分安装场景，除非你想源码编译安装。

#### 使用curl

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/xmake-io/xmake/master/scripts/get.sh)
```

#### 使用wget

```bash
bash <(wget https://raw.githubusercontent.com/xmake-io/xmake/master/scripts/get.sh -O -)
```

#### 使用powershell

```bash
Invoke-Expression (Invoke-Webrequest 'https://raw.githubusercontent.com/xmake-io/xmake/master/scripts/get.ps1' -UseBasicParsing).Content
```

## 创建空工程

xmake里面提供了带有tbox的空工程模板，因此可以通过xmake创建一个基于tbox的空工程，来快速集成和编译使用tbox库。

我们只需要执行命令：

```bash
$ xmake create -t console_tbox test
```

我们的基于tbox的控制台程序就创建好了，我们来看下这个工程里面的结构：

```
.
├── src
│   ├── main.c
│   └── xmake.lua
└── xmake.lua
```

非常简单，xmake.lua的大致内容，精简下，就长这样：

```lua
add_requires("tbox")
target("test")
    set_kind("binary")
    add_files("src/*.c")
```

说白了，就是加上了tbox的依赖库引用。

而main.c里面，仅仅只引用了tbox.h头文件，非常简单：

```c
#include "tbox/tbox.h"

tb_int_t main(tb_int_t argc, tb_char_t** argv)
{
    // init tbox
    if (!tb_init(tb_null, tb_null)) return -1;

    // trace
    tb_trace_i("hello tbox!");

    // exit tbox
    tb_exit();
    return 0;
}
```

## 编译工程

创建完工程，接下来就是编译了，这步也非常简单，只需要执行xmake命令即可完成编译：

```bash
$ xmake
checking for the architecture ... x86_64
checking for the Xcode directory ... /Applications/Xcode.app
checking for the SDK version of Xcode ... 10.14
checking for the Cuda SDK directory ... /Developer/NVIDIA/CUDA-10.1
note: try installing these packages (pass -y to skip confirm)?
in xmake-repo:
  -> tbox v1.6.3 
please input: y (y/n)

  => install tbox v1.6.3 .. ok                                                                                                                                                    
ruki:test ruki$ xmake -r 
[  0%]: ccache compiling.release src/main.c
[100%]: linking.release test
build ok!👌
```

xmake会去自动下载tbox库依赖，并且自动安装集成tbox库到当前项目中去，用户不需要关心其他任何细节，只管安心敲代码调用tbox接口实现自己的逻辑就行了。

## 运行程序

编译完，可以敲下面的命令完成运行：

```bash
$ xmake run
```

## 调试程序

如果要调用gdb/lldb/vsjitdebugger等调试器来调试程序，只需要运行的时候加上`-d`参数，并且开启调试编译模式：

```bash
$ xmake f -m debug
$ xmake
$ xmake run -d
```

由于默认编译式release模式，不带调试符号信息，因此如果要调试程序，可以先启用debug模式编译后，再调试运行即可。

