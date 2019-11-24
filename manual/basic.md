## Print

### Printing info information

Display a line of information under the terminal, it will automatically wrap, debugging, release mode will be displayed

```c
tb_trace_i("hello world");
```

Display: `[tbox]: hello world`

!> Each line of output has a tag prefix to indicate which module information, the default is `[tbox]`, but can also be redefined by modifying the `tb_TRACE_PREFIX` macro.

### Print debugging information

Output debug information, only in debug mode.

```c
tb_trace_d("hello world");
```

Display: `[tbox]: hello world`

!> The output will only be output when the debug mode is enabled: make config DEBUG=y, or if the module internally defines `TB_TRACE_MODULE_DEBUG == 1`, otherwise it will be ignored directly when compiling.

### Print warning message

Output warning message, debugging and release mode will be displayed

```c
tb_trace_w("hello world");
```

Display: `[tbox]: [warning]: hello world`

### Print other information

Prompt that some features have not been implemented yet.

```c
tb_trace_noimpl();
```

Display: `[tbox]: [no_impl]: at func: ..., line: ..., file: ...`

### Print by module

Output submodule tag

```c
#define TB_TRACE_MODULE_NAME "module"
#include "tbox.h"

tb_trace_i("hello world");
```

Display: `[tbox]: [module]: hello world`

### Output to file

```c
tb_trace_mode_set(TB_TRACE_MODE_FILE);
tb_trace_file_set_path("/tmp/log", tb_false);
```

It can be output to /tmp/log.

### Other platform output

In ios and android, in addition to output to the debug terminal, it will be directly output to syslog, which can be directly viewed through adb logcat or xcode.

## Assertion and detection

Assertion is a fast and effective mechanism to detect and respond to errors during the debugging period. If you add some asserts at the input and output of each interface, you can find hidden bugs in the program early and improve development and debugging efficiency.

### Static Assertion

Detection at compile time, generally used for type size, constant detection, for example:

```c
tb_assert_static(sizeof(tb_byte_t) == 1);
tb_assert_static(sizeof(tb_uint_t) == 4);
tb_assert_static(sizeof(tb_uint8_t) == 1);
tb_assert_static(sizeof(tb_uint16_t) == 2);
tb_assert_static(sizeof(tb_uint32_t) == 4);
tb_assert_static(sizeof(tb_hize_t) == 8);
```

### Runtime assertion

Detect in debug mode, valid only in debug mode, if __tb_debug__ is not defined, the code will be ignored

If the assertion fails, abort is fired and the full detailed current position stack is printed

```c
tb_assert(x);
```

### Runtime check

Detect in release mode, regardless of whether it is in debug mode

```c
tb_check_return(x);
tb_check_return_val(x, v);
tb_check_goto(x, b);
tb_check_break(x);
tb_check_abort(x);
tb_check_continue(x);
```

### Assertion and check

Simultaneous detection in debug and release mode

```c
tb_assert_and_check_abort(x);
tb_assert_and_check_return(x);
tb_assert_and_check_return_val(x, v);
tb_assert_and_check_goto(x, b);
tb_assert_and_check_break(x);
tb_assert_and_check_continue(x);
```
