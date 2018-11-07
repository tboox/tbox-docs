# Getting Started

Please install xmake first: [xmake](https://github.com/tboox/xmake)

```bash
# build for the host platform
$ cd ./tbox
$ xmake

# build for the mingw platform
$ cd ./tbox
$ xmake f -p mingw --sdk=/home/mingwsdk 
$ xmake

# build for the iphoneos platform
$ cd ./tbox
$ xmake f -p iphoneos 
$ xmake

# build for the android platform
$ cd ./tbox
$ xmake f -p android --ndk=xxxxx
$ xmake

# build for the linux cross-platform
$ cd ./tbox
$ xmake f -p linux --sdk=/home/sdk # --bin=/home/sdk/bin
$ xmake
```
    
## Example

```c
#include "tbox/tbox.h"

int main(int argc, char** argv)
{
    // init tbox
    if (!tb_init(tb_null, tb_null)) return 0;

    // trace
    tb_trace_i("hello tbox");

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

    // init stream
    tb_stream_ref_t stream = tb_stream_init_from_url("http://www.xxx.com/file.txt");
    if (stream)
    {
        // open stream
        if (tb_stream_open(stream))
        {
            // read line
            tb_long_t size = 0;
            tb_char_t line[TB_STREAM_BLOCK_MAXN];
            while ((size = tb_stream_bread_line(stream, line, sizeof(line))) >= 0)
            {
                // trace
                tb_trace_i("line: %s", line);
            }
        }

        // exit stream
        tb_stream_exit(stream);
    }

    // wait 
    getchar();

    // exit tbox
    tb_exit();
    return 0;
}
```

