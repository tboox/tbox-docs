
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

## 生成IDE工程文件

### 生成vs工程

我们也可以通过生成vs工程来更方便的开发和调试，下面的命令同时生成带有debug, release两个编译模式的vc工程。

```bash
xmake project -k vs2017 -m "debug,release"
```

### 生成cmake文件

```bash
xmake project -k cmakelists
```

### 生成makefile

```bash
xmake project -k makefile
```

## 源码编译

除了通过创建空工程，在xmake.lua中使用`add_requires("tbox")`快速集成tbox，我们也可以通过现在tbox源码手动编译集成。

首先，我们需要下载tbox的源码：

```bash
git clone https://github.com/tboox/tbox.git
```

然后进入工程根目录，执行xmake编译：

```bash
cd tbox
xmake
```

编译完，我们可以通过安装或者打包的方式，获取对应的库文件和头文件

### 安装库

通过安装，可以将编译好的库和头文件安装到系统目录或者指定目录

```bash
xmake install 
xmake install -o /xxx/installdir
```

### 打包库

上面安装的方式，只能安装一个平台下对应arch的库，如果要同时切换平台和架构，编译生成一系列库版本，这种方式就很繁琐了，因此可以通过打包命令来完成。

```bash
xmake f -p iphoneos -a armv7
xmake
xmake package
xmake f -p iphoneos -a arm64 -m debug
xmake
xmake package
```

上述命令，编译了iphoneos下，两个arch库，并且其中arm64库是debug版本的，进行打包，生成后的结果如下：

```
build/tbox.pkg/
├── iphoneos
│   ├── arm64
│   │   ├── include
│   │   │   └── tbox
│   │   │       ├── algorithm
│   │   └── lib
│   │       └── debug
│   │           └── libtbox.a
│   └── armv7
│       ├── include
│       │   └── tbox
│       └── lib
│           └── release
│               └── libtbox.a
└── xmake.lua
```

可以看出，打包命令，会在build目录下生成tbox.pkg包，里面对不同平台、不同arch、不同编译模式以及头文件都做了归类整理，这对于一次输出不同的库是非常有帮助的。

并且，xmake还提供了一个辅助的宏命令，可以锦衣简化打包流程，实现对一个平台下的所有arch，进行批量打包，尤其是iphoneos下，还会同时生成universal包：

```bash
xmake macro package -p iphoneos
```

如果想要切到debug模式，一次生成所有arch的包，可以传递配置进去：

```bash
xmake macro package -p iphoneos -f "-m debug"
```

### 集成库
