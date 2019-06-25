
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

#### 集成本地包

我们通过xmake的打包命令生成的tbox.pkg包，是可以直接引用集成到自己项目中去的，只要设置上对应的头文件搜索路径以及库路径即可

而如果是在xmake的项目中，集成就更加方便了，只需要编辑xmake.lua文件，加上两行：

```lua
add_packagedirs("packages")
target("test")
    set_kind("binary")
    add_files("src/*.c")
    add_packages("tbox")
```

我们通过add_packagedirs指定下tbox.pkg所在的目录，然后就可以通过`add_packages("tbox")`直接引用集成对应的包，xmake在编译的时候，会自动处理头文件和库路径的搜索。

!> 不过需要注意的一点是，如果是编译使用debug版本的tbox库，还需要在自己的项目中，额外定义`__tb_debug__`宏标示下才行。

因此，我们可以继续完善下，加上release/debug模式支持：

```lua
add_packagedirs("packages")
add_rules("mode.debug", "mode.release")
if is_mode("debug") then
    add_defines("__tb_debug__")
end
target("test")
    set_kind("binary")
    add_files("src/*.c")
    add_packages("tbox")
```

#### 集成远程依赖包

当然如果觉得这样编译tbox库集成还是比较繁琐，可以采用上面说的远程依赖下载模式，xmake会自己处理tbox库的下载编译和集成。

```lua
add_requires("tbox")
add_rules("mode.debug", "mode.release")
target("test")
    set_kind("binary")
    add_files("src/*.c")
    add_packages("tbox")
```

我们不需要再自己下载源码编译tbox，只需要设置`add_requires("tbox")`添加需要的包依赖就行了，xmake会自动从官方包仓库下载tbox包的描述信息，然后自动编译和安装集成，有点类似homebrew的方式。

如果需要使用debug版本tbox库，只需要改成：

```lua
add_requires("tbox", {debug = true})
```

用户也不需要额外加`__tb_debug__`宏了因为这些都会自动处理。

如果要使用指定版本的tbox库，或者dev/master版本库，只需要：


```lua
add_requires("tbox dev")
add_requires("tbox master")
add_requires("tbox 1.6.3")
add_requires("tbox >1.6.0")
add_requires("tbox ~1.6.0")
```

集成方式是支持语义版本依赖的哦，更多关于这块的使用描述，可以看下xmake的官方文档：[远程依赖模式](https://xmake.io/#/zh-cn/guide/package_management?id=%e8%bf%9c%e7%a8%8b%e4%be%9d%e8%b5%96%e6%a8%a1%e5%bc%8f)

### 模块配置

默认编译和集成的tbox库，为small编译模式，是不带有任何扩展模块的，如果想要使用一些扩展，需要自己手动启用。

对于源码编译方式，可以通过如下方式启用对应模块来编译tbox:

```bash
xmake f --xml=y --coroutine=y
xmake
```

对于远程依赖方式，启用对应模块也很方便，在xmake.lua里面改下依赖规则就好：

```lua
add_requires("tbox", {configs = {xml = true, coroutine = true}})
```

### 代码示例

tbox的`src/demo`源码目录下，集成了各个模块的使用例子，可以参考其中的用法也熟悉不同模块接口的使用，也可以参看对应模块头文件中的接口注释说明来获取更多信息。

而demo下的测试运行，可以进入tbox根目录，编译后通过下面的命令来运行：

```bash
xmake run demo coroutine_http_server
```

上面的命令就是运行tbox中的基于协程的`http_server`例子程序，我们也可以通过下面的命令列举当前所有的例子程序名：

```bash
xmake run demo
```

输出结果如下：

```
[demo]: ======================================================================
[demo]: Usages: xmake r demo [testname] arguments ...
[demo]: 
[demo]: .e.g
[demo]:     xmake r demo stream http://www.xxxxx.com /tmp/a
[demo]: 
[demo]: testname: libc_time
[demo]: testname: libc_wchar
[demo]: testname: libc_string
[demo]: testname: libc_stdlib
[demo]: testname: libc_wcstombs
[demo]: testname: coroutine_echo_client
[demo]: testname: coroutine_file_client
[demo]: testname: coroutine_http_server
[demo]: testname: coroutine_spider
...
```

太长了，这里就不全列举出来，大家可以自己运行后看下。

### 调试分析

除了用调试器运行后进行调试，tbox库的debug版本还内置的大量了assert检测，以及各种内存分析检测手段，包括内存泄露，内存越界分析等，依托于tbox库自带的内存池分配器。

因此，通常情况下，使用tbox库写完程序，只要在debug下运行没有任何报错，基本上程序算是比较稳定了。

#### 断言检测

tbox里面所有接口实现，加了大量的assert来判断程序状态和传参的有效性，只要用户传参不对，在debug模式基本上都能第一时间报出来，甚至一些堆溢出导致的问题，也会即使报出。

方便用户第一时间获取到错误信息，定位故障代码所有位置。

#### 内存越界检测

用户只要写完程序，启用debug版本运行程序，程序在出现常规对内存越界后，会自动报错提示。

越界溢出的检测，是实时完成的，而且对libc也做了插桩，所以对常用strcpy，memset等的使用，都回去检测：

```c
tb_void_t tb_demo_overflow()
{
    tb_pointer_t data = tb_malloc0(10);
    if (data)
    {
        tb_memset(data, 0, 11);
        tb_free(data);
    }
}
```

输出：

```
[tbox]: [memset]: [overflow]: [0x0 x 11] => [0x7f950b044508, 10]
[tbox]: [memset]: [overflow]: [0x0000010991a1c7]: 0   demo.b                              0x000000010991a1c7 tb_memset + 151
[tbox]: [memset]: [overflow]: [0x000001098a2d01]: 1   demo.b                              0x00000001098a2d01 tb_demo_overflow + 97
[tbox]: [memset]: [overflow]: [0x000001098a3044]: 2   demo.b                              0x00000001098a3044 tb_demo_memory_check_main + 20
[tbox]: [memset]: [overflow]: [0x0000010989a28e]: 3   demo.b                              0x000000010989a28e main + 878
[tbox]: [memset]: [overflow]: [0x007fff8c95a5fd]: 4   libdyld.dylib                       0x00007fff8c95a5fd start + 1
[tbox]: [memset]: [overflow]: [0x00000000000002]: 5   ???                                 0x0000000000000002 0x0 + 2
[tbox]: 	[malloc]: [from]: data: from: tb_demo_overflow(): 12, memory/check.c
[tbox]: 	[malloc]: [from]:     [0x0000010992662a]: 0   demo.b                              0x000000010992662a tb_fixed_pool_malloc0_ + 186
[tbox]: 	[malloc]: [from]:     [0x0000010993892b]: 1   demo.b                              0x000000010993892b tb_small_pool_malloc0_ + 507
[tbox]: 	[malloc]: [from]:     [0x00000109934b3c]: 2   demo.b                              0x0000000109934b3c tb_pool_malloc0_ + 540
[tbox]: 	[malloc]: [from]:     [0x000001098a2cd7]: 3   demo.b                              0x00000001098a2cd7 tb_demo_overflow + 55
[tbox]: 	[malloc]: [from]:     [0x000001098a3044]: 4   demo.b                              0x00000001098a3044 tb_demo_memory_check_main + 20
[tbox]: 	[malloc]: [from]:     [0x0000010989a28e]: 5   demo.b                              0x000000010989a28e main + 878
[tbox]: 	[malloc]: [from]:     [0x007fff8c95a5fd]: 6   libdyld.dylib                       0x00007fff8c95a5fd start + 1
[tbox]: 	[malloc]: [from]:     [0x00000000000002]: 7   ???                                 0x0000000000000002 0x0 + 2
[tbox]: 	[malloc]: [from]: data: 0x7f950b044508, size: 10, patch: cc
[tbox]: 	[malloc]: [from]: data: first 10-bytes:
[tbox]: ===================================================================================================================================================
[tbox]: 00000000   00 00 00 00  00 00 00 00  00 00                                                                         ..........
[tbox]: [error]: abort at tb_memset(): 255, libc/string/memset.c
```

#### 内存泄露检测

内存泄露的检测必须在程序退出的前一刻，调用`tb_exit()`的时候，才会执行，如果有泄露，会有详细输出到终端上。

```c
tb_void_t tb_demo_leak()
{
    tb_pointer_t data = tb_malloc0(10);
}
```

输出：

```
[tbox]: [error]: leak: 0x7f9d5b058908 at tb_static_fixed_pool_dump(): 735, memory/impl/static_fixed_pool.c
[tbox]: [error]: data: from: tb_demo_leak(): 43, memory/check.c
[tbox]: [error]:     [0x000001050e742a]: 0   demo.b                              0x00000001050e742a tb_fixed_pool_malloc0_ + 186
[tbox]: [error]:     [0x000001050f972b]: 1   demo.b                              0x00000001050f972b tb_small_pool_malloc0_ + 507
[tbox]: [error]:     [0x000001050f593c]: 2   demo.b                              0x00000001050f593c tb_pool_malloc0_ + 540
[tbox]: [error]:     [0x00000105063cd7]: 3   demo.b                              0x0000000105063cd7 tb_demo_leak + 55
[tbox]: [error]:     [0x00000105063e44]: 4   demo.b                              0x0000000105063e44 tb_demo_memory_check_main + 20
[tbox]: [error]:     [0x0000010505b08e]: 5   demo.b                              0x000000010505b08e main + 878
[tbox]: [error]:     [0x007fff8c95a5fd]: 6   libdyld.dylib                       0x00007fff8c95a5fd start + 1
[tbox]: [error]:     [0x00000000000002]: 7   ???                                 0x0000000000000002 0x0 + 2
[tbox]: [error]: data: 0x7f9d5b058908, size: 10, patch: cc
```

#### 内存重叠覆盖检测

如果两块内存的copy发生了重叠，有可能会覆盖掉部分数据，导致bug，因此TBOX对此也做了些检测。

```c
tb_void_t tb_demo_overlap()
{
    tb_pointer_t data = tb_malloc(10);
    if (data)
    {
        tb_memcpy(data, (tb_byte_t const*)data + 1, 5);
        tb_free(data);
    }
}
```

输出

```
[tbox]: [memcpy]: [overlap]: [0x7fe9b5042509, 5] => [0x7fe9b5042508, 5]
[tbox]: [memcpy]: [overlap]: [0x000001094403b8]: 0   demo.b                              0x00000001094403b8 tb_memcpy + 632
[tbox]: [memcpy]: [overlap]: [0x000001093c99f9]: 1   demo.b                              0x00000001093c99f9 tb_demo_overlap + 105
[tbox]: [memcpy]: [overlap]: [0x000001093c9a44]: 2   demo.b                              0x00000001093c9a44 tb_demo_memory_check_main + 20
[tbox]: [memcpy]: [overlap]: [0x000001093c0c8e]: 3   demo.b                              0x00000001093c0c8e main + 878
[tbox]: [memcpy]: [overlap]: [0x007fff8c95a5fd]: 4   libdyld.dylib                       0x00007fff8c95a5fd start + 1
[tbox]: [memcpy]: [overlap]: [0x00000000000002]: 5   ???                                 0x0000000000000002 0x0 + 2
[tbox]: 	[malloc]: [from]: data: from: tb_demo_overlap(): 58, memory/check.c
[tbox]: 	[malloc]: [from]:     [0x0000010945eadb]: 0   demo.b                              0x000000010945eadb tb_small_pool_malloc_ + 507
[tbox]: 	[malloc]: [from]:     [0x0000010945b23c]: 1   demo.b                              0x000000010945b23c tb_pool_malloc_ + 540
[tbox]: 	[malloc]: [from]:     [0x000001093c99c7]: 2   demo.b                              0x00000001093c99c7 tb_demo_overlap + 55
[tbox]: 	[malloc]: [from]:     [0x000001093c9a44]: 3   demo.b                              0x00000001093c9a44 tb_demo_memory_check_main + 20
[tbox]: 	[malloc]: [from]:     [0x000001093c0c8e]: 4   demo.b                              0x00000001093c0c8e main + 878
[tbox]: 	[malloc]: [from]:     [0x007fff8c95a5fd]: 5   libdyld.dylib                       0x00007fff8c95a5fd start + 1
[tbox]: 	[malloc]: [from]:     [0x00000000000002]: 6   ???                                 0x0000000000000002 0x0 + 2
[tbox]: 	[malloc]: [from]: data: 0x7fe9b5042508, size: 10, patch: cc
[tbox]: 	[malloc]: [from]: data: first 10-bytes:
[tbox]: ===================================================================================================================================================
[tbox]: 00000000   CC CC CC CC  CC CC CC CC  CC CC                                                                         ..........
[tbox]: [error]: abort at tb_memcpy(): 125, libc/string/memcpy.c
```

#### 内存双重释放检测

```c
tb_void_t tb_demo_free2()
{
    tb_pointer_t data = tb_malloc0(10);
    if (data)
    {
        tb_free(data);
        tb_free(data);
    }
}
```

输出

```
[tbox]: [assert]: expr[((impl->used_info)[(index) >> 3] & (0x1 << ((index) & 7)))]: double free data: 0x7fd93386c708 at tb_static_fixed_pool_free(): 612, memory/impl/static_fixed_pool.c
[tbox]:     [0x0000010c9f553c]: 0   demo.b                              0x000000010c9f553c tb_static_fixed_pool_free + 972
[tbox]:     [0x0000010c9ee7a9]: 1   demo.b                              0x000000010c9ee7a9 tb_fixed_pool_free_ + 713
[tbox]:     [0x0000010ca01ff5]: 2   demo.b                              0x000000010ca01ff5 tb_small_pool_free_ + 885
[tbox]:     [0x0000010c9fdb4f]: 3   demo.b                              0x000000010c9fdb4f tb_pool_free_ + 751
[tbox]:     [0x0000010c96ac8e]: 4   demo.b                              0x000000010c96ac8e tb_demo_free2 + 158
[tbox]:     [0x0000010c96ae44]: 5   demo.b                              0x000000010c96ae44 tb_demo_memory_check_main + 20
[tbox]:     [0x0000010c96208e]: 6   demo.b                              0x000000010c96208e main + 878
[tbox]:     [0x007fff8c95a5fd]: 7   libdyld.dylib                       0x00007fff8c95a5fd start + 1
[tbox]:     [0x00000000000002]: 8   ???                                 0x0000000000000002 0x0 + 2
[tbox]: [error]: free(0x7fd93386c708) failed! at tb_demo_free2(): 37, memory/check.c at tb_static_fixed_pool_free(): 649, memory/impl/static_fixed_pool.c
[tbox]: [error]: data: from: tb_demo_free2(): 33, memory/check.c
[tbox]: [error]:     [0x0000010c9ee42a]: 0   demo.b                              0x000000010c9ee42a tb_fixed_pool_malloc0_ + 186
[tbox]: [error]:     [0x0000010ca0072b]: 1   demo.b                              0x000000010ca0072b tb_small_pool_malloc0_ + 507
[tbox]: [error]:     [0x0000010c9fc93c]: 2   demo.b                              0x000000010c9fc93c tb_pool_malloc0_ + 540
[tbox]: [error]:     [0x0000010c96ac27]: 3   demo.b                              0x000000010c96ac27 tb_demo_free2 + 55
[tbox]: [error]:     [0x0000010c96ae44]: 4   demo.b                              0x000000010c96ae44 tb_demo_memory_check_main + 20
[tbox]: [error]:     [0x0000010c96208e]: 5   demo.b                              0x000000010c96208e main + 878
[tbox]: [error]:     [0x007fff8c95a5fd]: 6   libdyld.dylib                       0x00007fff8c95a5fd start + 1
[tbox]: [error]:     [0x00000000000002]: 7   ???                                 0x0000000000000002 0x0 + 2
[tbox]: [error]: data: 0x7fd93386c708, size: 10, patch: cc
[tbox]: [error]: data: first 10-bytes:
[tbox]: ===================================================================================================================================================
[tbox]: 00000000   00 00 00 00  00 00 00 00  00 00                                                                         ..........
[tbox]: [error]: abort at tb_static_fixed_pool_free(): 655, memory/impl/static_fixed_pool.c
```
