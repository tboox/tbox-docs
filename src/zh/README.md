---
home: true
actionText: 快速上手 →
actionLink: /zh/guide/getting-started
features:
  - title: 为什么使用
    details: 针对各个平台，封装了统一的接口，简化了各类开发过程中常用操作，使C开发更加的简单高效
  - title: 强大
    details: 提供大量的实用模块（例如：流处理，协程，正则, 容器，算法，数据库等常用模块）
  - title: 跨平台
    details: 支持windows, macOS, linux, android, ios
footer: Apache-2.0 Licensed | Copyright © 2009-present tboox.org
---

```c
#include "tbox/tbox.h"

int main(int argc, char** argv)
{
    // init tbox
    if (!tb_init(tb_null, tb_null)) return 0;

    // init vector
    tb_vector_ref_t vector = tb_vector_init(0, tb_element_cstr(tb_true));
    if (vector)
    {
        // insert item
        tb_vector_insert_tail(vector, "hello");
        tb_vector_insert_tail(vector, "tbox");

        // dump all items
        tb_for_all (tb_char_t const*, cstr, vector)
        {
            // trace
            tb_trace_i("%s", cstr);
        }

        // exit vector
        tb_vector_exit(vector);
    }

    // exit tbox
    tb_exit();
}
```
