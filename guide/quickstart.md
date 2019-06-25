## Ready to work

### Installing xmake

To compile the tbox source, you need to install the [xmake](https://github.com/xmake-io/xmake) build tool first, because the entire tbox project is maintained by xmake, a cross-platform build tool.

For how to install xmake, you can look at: [xmake installation documentation](https://xmake.io/#/guide/installation)

The inside is very detailed, of course, under normal circumstances, the following installation methods can basically meet most of the installation scenarios, unless you want to compile and install the source code.

#### via curl

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/xmake-io/xmake/master/scripts/get.sh)
```

#### via wget

```bash
bash <(wget https://raw.githubusercontent.com/xmake-io/xmake/master/scripts/get.sh -O -)
```

#### via powershell

```bash
Invoke-Expression (Invoke-Webrequest 'https://raw.githubusercontent.com/xmake-io/xmake/master/scripts/get.ps1' -UseBasicParsing).Content
```

## Create an empty project with tbox

Xmake provides an empty project template with tbox, so you can create a tbox-based empty project via xmake to quickly integrate and compile the tbox library.

We only need to execute the command:

```bash
$ xmake create -t console_tbox test
```

Our tbox-based console program is created, let's take a look at the structure inside this project:

```
.
├── src
│   ├── main.c
│   └── xmake.lua
└── xmake.lua
```

Very simple, the general content of xmake.lua, under the simplification, it is like this:

```lua
add_requires("tbox")
target("test")
    set_kind("binary")
    add_files("src/*.c")
```

To put it bluntly, it is to add a reference library reference to tbox.

In main.c, only the tbox.h header file is referenced, which is very simple:

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

## Compiling project

After the project is created, the next step is to compile. This step is also very simple. You only need to execute the xmake command to compile:

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

Xmake will automatically download the tbox library dependencies, and automatically install the integrated tbox library into the current project, the user does not need to care about any other details, just trust the code to call the tbox interface to achieve their own logic.

## Run program

After compiling, you can complete the run by typing the following command:

```bash
$ xmake run
```

## Debug program

If you want to call the debugger such as gdb/lldb/vsjitdebugger to debug the program, just add the `-d` parameter when running, and turn on the debug compilation mode:

```bash
$ xmake f -m debug
$ xmake
$ xmake run -d
```

Because the default compiled release mode, without debugging symbol information, so if you want to debug the program, you can first enable the debug mode to compile, then debug and run.

## Generate IDE project files

### Generate vs project

We can also develop and debug more conveniently by generating a vs project. The following command also generates a vc project with two compilation modes: debug and release.

```bash
xmake project -k vs2017 -m "debug,release"
```

### Generate cmake file

```bash
xmake project -k cmakelists
```

### Generate makefile

```bash
xmake project -k makefile
```
## Compile Source code 

In addition to creating an empty project, using `add_requires("tbox")` in xmake.lua to quickly integrate tbox, we can also manually compile the integration through the current tbox source.

First, we need to download the source code of tbox:

```bash
git clone https://github.com/tboox/tbox.git
```

Then enter the project root directory and execute xmake compilation:

```bash
cd tbox
xmake
```

After compiling, we can get the corresponding library files and header files by installing or packaging.

### Install library

Through the installation, you can install the compiled library and header files to the system directory or specify the directory.

```bash
xmake install 
xmake install -o /xxx/installdir
```

### Package library

The above installation method can only install the corresponding arch library under one platform. If you want to switch the platform and architecture at the same time, compile and generate a series of library versions. This method is very cumbersome, so it can be completed by the packaging command.

```bash
xmake f -p iphoneos -a armv7
xmake
xmake package
xmake f -p iphoneos -a arm64 -m debug
xmake
xmake package
```

The above command compiles two arch libraries under iphoneos, and the arm64 library is the debug version, which is packaged. The generated result is as follows:

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

It can be seen that the package command will generate the tbox.pkg package in the build directory, which categorizes different platforms, different arches, different compilation modes, and header files. This is very helpful for outputting different libraries at a time. of.

Moreover, xmake also provides an auxiliary macro command, which can simplify the packaging process and implement bulk packaging for all arches under one platform. Especially under iphoneos, it also generates a universal package:

```bash
xmake macro package -p iphoneos
```

If you want to cut to debug mode, generate all the arch packages at once, you can pass the configuration into:

```bash
xmake macro package -p iphoneos -f "-m debug"
```

### Integrate library

#### Integrate local packages

The tbox.pkg package generated by the xmake package command can be directly referenced and integrated into our own project. Just set the corresponding header file search path and library path.

And if it is in the xmake project, the integration is more convenient, just edit the xmake.lua file, plus two lines:

```lua
add_packagedirs("packages")
target("test")
    set_kind("binary")
    add_files("src/*.c")
    add_packages("tbox")
```

We specify the directory where tbox.pkg is located by add_packagedirs, and then we can directly reference the integrated package through `add_packages("tbox"). When xmake compiles, it will automatically handle the search of header files and library paths.

!> However, it should be noted that if you compile the tbox library using the debug version, you need to define the `__tb_debug__` macro in your own project.

Therefore, we can continue to improve, plus release/debug mode support:

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

#### Integrate Remote Dependency Package

Of course, if you think that compiling the tbox library integration is rather cumbersome, you can use the remote dependency download mode mentioned above, xmake will handle the download compilation and integration of the tbox library.

```lua
add_requires("tbox")
add_rules("mode.debug", "mode.release")
target("test")
    set_kind("binary")
    add_files("src/*.c")
    add_packages("tbox")
```

We don't need to download the source code to compile the tbox. We only need to set `add_requires("tbox") to add the required package dependencies. xmake will automatically download the description of the tbox package from the official package repository, and then automatically compile and install the integration. A bit like the way homebrew.

If you need to use the debug version of the tbox library, you only need to change it to:

```lua
add_requires("tbox", {debug = true})
```

Users do not need to add the extra `__tb_debug__` macro because these will be handled automatically.

If you want to use the specified version of the tbox library, or the dev/master repository, you only need to:

```lua
add_requires("tbox dev")
add_requires("tbox master")
add_requires("tbox 1.6.3")
add_requires("tbox >1.6.0")
add_requires("tbox ~1.6.0")
```

The integration method is to support the semantic version dependency. For more information about the use of this block, you can look at the official documentation of xmake: [remote dependency mode] (https://xmake.io/#/zh-cn/guide/package_management ?id=%e8%bf%9c%e7%a8%8b%e4%be%9d%e8%b5%96%e6%a8%a1%e5%bc%8f)

### Module Configuration

The default compiled and integrated tbox library, compiled for small mode, does not have any extension modules. If you want to use some extensions, you need to manually enable them.

For source code compilation, you can enable the corresponding module to compile tbox by:

```bash
xmake f --xml=y --coroutine=y
xmake
```

For the remote dependency mode, it is convenient to enable the corresponding module. Change the dependency rule in xmake.lua:

```lua
add_requires("tbox", {configs = {xml = true, coroutine = true}})
```

### Code Example

In the `src/demo` source directory of tbox, the usage examples of each module are integrated. You can refer to the usage and familiarity with the use of different module interfaces. You can also refer to the interface comment description in the corresponding module header file for more information.

The test run under the demo, you can enter the tbox root directory, compile and run through the following command:

```bash
xmake run demo coroutine_http_server
```

The above command is to run the `http_server` example program based on coroutine in tbox. We can also list all current example program names by the following command:

```bash
xmake run demo
```

The output is as follows:

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

It’s too long, it’s not listed here, everyone can look at it after running it.

### Debug and analysis

In addition to debugging with the debugger, the debug version of the tbox library also has a large number of assert detections built in, as well as various memory analysis and detection methods, including memory leaks, memory out-of-bounds analysis, etc., relying on the memory pool allocator that comes with the tbox library. .

Therefore, under normal circumstances, using the tbox library to write the program, as long as there is no error under the debug, basically the program is relatively stable.

#### Assertion detection

All interfaces in tbox are implemented, and a large number of asserts are added to judge the validity of the program state and the parameters. As long as the user passes the wrong parameters, the debug mode can basically report the first time, and even some heap overflow problems. Will even report it.

It is convenient for the user to obtain the error information in the first time and locate all the locations of the fault code.

#### Memory out of bounds detection

As long as the user finishes writing the program and enables the debug version to run the program, the program will automatically report an error when the memory is out of bounds.

The detection of the out-of-boundary overflow is done in real time, and the libc is also instrumented, so the use of commonly used strcpy, memset, etc., is back to detect:

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

Output:

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

#### Memory leak detection

The detection of memory leaks must be executed when `tb_exit()` is called immediately before the program exits. If there is a leak, it will be output to the terminal in detail.

```c
tb_void_t tb_demo_leak()
{
    tb_pointer_t data = tb_malloc0(10);
}
```

Output:

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

#### Memory Overlap Cover Detection

If the copy of the two memories overlaps, it may overwrite some of the data, causing a bug, so TBOX has also done some detection.

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

Output:

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

#### Memory Double Release Detection

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

Output:

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
