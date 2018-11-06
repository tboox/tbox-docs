---
home: true
actionText: Get Started →
actionLink: /guide/getting-started
features:
  - title: Why
    details: Making C development easier, so that any developer can quickly pick it up and enjoy the productivity boost when developing in C language.
  - title: Powerful
    details: Provides lots of modules (e.g. stream, coroutine, regex, container, algorithm and etc).
  - title: Cross-platform
    details: Supports windows, macOS, linux, android and ios.
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
