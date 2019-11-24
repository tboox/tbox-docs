## 打印输出

### 打印info信息

在终端下显示输出一行信息，会自动换行，调试、发布模式都会显示

```c
tb_trace_i("hello world");
```

显示：`[tbox]: hello world`

!> 每行输出都带有标记前缀，来表示哪个模块的信息，默认是`[tbox]`， 但也可以通过修改`TB_TRACE_PREFIX`宏来重定义。

### 打印调试信息

输出调试信息，仅在调试模式下起作用。

```c
tb_trace_d("hello world");
```

显示：`[tbox]: hello world`

!> 只有在开启调试模式：make config DEBUG=y的情况，或者模块内部定义了`TB_TRACE_MODULE_DEBUG == 1`的时候才会进行输出，否则编译的时候会直接忽略掉。

### 打印警告信息

输出警告信息，调试、发布模式都会显示

```c
tb_trace_w("hello world");
```

显示：`[tbox]: [warning]: hello world`

### 打印其他信息

提示某些功能还没实现。

```c
tb_trace_noimpl();
```

显示：`[tbox]: [no_impl]: at func: ..., line: ..., file: ...`

### 分模块打印

输出子模块标记

```c
#define TB_TRACE_MODULE_NAME             "module"
#include "tbox.h"

tb_trace_i("hello world");
```

显示：`[tbox]: [module]: hello world`

### 输出到文件

```c
tb_trace_mode_set(TB_TRACE_MODE_FILE);
tb_trace_file_set_path("/tmp/log", tb_false);
```

就可以输出到/tmp/log中了。

### 其他平台输出

在ios和android下，除了会输出到调试终端，还会直接输出到syslog中， 可以通过adb logcat 或者xcode直接查看

## 断言与检测

断言，是一种快速有效的在调试期，检测并响应错误的机制，如果在每个接口的输入输出等位置， 加一些assert，可以提早发现程序中隐藏的bug，提高开发和调试效率。

### 静态断言

在编译期进行检测，一般用于类型大小、常量的检测，例如：

```c
tb_assert_static(sizeof(tb_byte_t) == 1);
tb_assert_static(sizeof(tb_uint_t) == 4);
tb_assert_static(sizeof(tb_uint8_t) == 1);
tb_assert_static(sizeof(tb_uint16_t) == 2);
tb_assert_static(sizeof(tb_uint32_t) == 4);
tb_assert_static(sizeof(tb_hize_t) == 8);
```

### 运行时断言

在调试模式下进行检测，仅在调试模式下有效，如果__tb_debug__没有被定义，这些代码都会被忽略

如果断言失败，则会触发abort，并且打印完整详细的当前位置堆栈

```c
tb_assert(x);
```

### 运行时检测

在发布模式下进行检测，不管是否在调试模式，都会进行检测

```c
tb_check_return(x);
tb_check_return_val(x, v);
tb_check_goto(x, b);
tb_check_break(x);
tb_check_abort(x);
tb_check_continue(x);
```

### 断言并检测

在调试和发布模式下同时进行检测

```c
tb_assert_and_check_abort(x);
tb_assert_and_check_return(x);
tb_assert_and_check_return_val(x, v);
tb_assert_and_check_goto(x, b);
tb_assert_and_check_break(x);
tb_assert_and_check_continue(x);
```
 
