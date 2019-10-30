## 整体架构

tbox主要有三种流：

1. **stream**: 最常用的流，一般用于单路阻塞、非阻塞io的处理，接口简单易用
3. **static_stream**：静态流，用于对纯buffer的位流处理，一般用于各种解析器

并且我们可以在其上挂接多路filter，实现流之间数据过滤和变换。目前支持以下几种filter：

1. **zip_filter：gzip**、zlib的压缩和解压缩过滤器
2. **charset_filter**：字符集编码的过滤器
3. **chunked_filter：http** chunked编码的解码过滤器


如果在一个xml解析器上同时挂接：


```
http/xml => chunked_filter => zip_filter => charset_filter => stream => xml_reader
```

就可以实现对xml文件的边下载、边解压、边转码、边解析，这样就可以完美支持大规模xml数据的解析支持，而且内存使用率也不会太高

另外我们还可以**基于流的传输器**将两路stream进行连接，实现方便的http下载、上传、文件之间的copy等等。

目前的流可以支持如下几种url格式：

1. data://base64
2. file://path or unix path: e.g. /root/xxxx/file
3. sock://host:port?tcp=
4. sock://host:port?udp=
5. socks://host:port
6. http://host:port/path?arg0=&arg1=...
7. https://host:port/path?arg0=&arg1=...

具体架构见下图：

![](/assets/img/manual/streamarch.png)

## 流的读写

stream是tbox的最常用的流，一般用于单路io操作，既可以进行阻塞读写，也可以非阻塞的读写。

目前可以支持 数据、文件、套接字、http协议以及各种过滤器的读写操作，也可以很方便的自定义扩展自己的流模块。

### 流的常用初始化操作

下面直接上代码吧，基本上看下注释就知道怎么使用了，嘿嘿。。。


```c
    // 初始化文件流
    tb_stream_ref_t stream = tb_stream_init_from_url("/root/home/file");
    tb_stream_ref_t stream = tb_stream_init_from_file("/root/home/file", TB_FILE_MODE_RW | TB_FILE_MODE_CREAT | TB_FILE_MODE_BINARY | TB_FILE_MODE_TRUNC);

    // 初始化http流
    tb_stream_ref_t stream = tb_stream_init_from_url("http://www.xxxx.com/file?args=xxx");
    tb_stream_ref_t stream = tb_stream_init_from_http("www.xxxx.com", 80, "/file?args=xxx",tb_false );

    // 初始化tcp流
    tb_stream_ref_t stream = tb_stream_init_from_url("sock://localhost/8080");
    tb_stream_ref_t stream = tb_stream_init_from_sock("localhost", 8080, TB_SOCKET_TYPE_TCP, tb_false);

    // 初始化udp流
    tb_stream_ref_t stream = tb_stream_init_from_url("sock://localhost/8080?udp=");
    tb_stream_ref_t stream = tb_stream_init_from_sock("localhost", 8080, TB_SOCKET_TYPE_UDP, tb_false);

    // 初始化数据流
    tb_stream_ref_t stream = tb_stream_init_from_url("data://base64_data");
    tb_stream_ref_t stream = tb_stream_init_from_data(data, size);

    // 初始化字符集编码流
    tb_stream_ref_t stream = tb_stream_init_filter_from_charset(stream, TB_CHARSET_TYPE_UTF8, TB_CHARSET_TYPE_GBK);

    // 初始化gzip解压缩流
    tb_stream_ref_t stream = tb_stream_init_filter_from_zip(stream, TB_ZIP_ALGO_GZIP, TB_ZIP_ACTION_INFLATE);
```

### 非阻塞读取模式

```c
    // 初始化http流
    tb_stream_ref_t stream = tb_stream_init_from_url("https://tboox.org");
    if (stream)
    {
        // 阻塞打开流，如果想在其他线程中断它，可以调用tb_stream_kill来实现
        if (tb_stream_open(stream))
        {
            /* 判断流是否读取结束
             * 
             * 1. 如果这个流是能获取到文件大小的: 
             * tb_stream_size(stream) >= 0 的情况下， 流读取偏移到流尾部，
             * beof 就直接返回tb_false 表示结束了。
             *
             * 2. 如果这个流是流式， 无法获取实际大小， 比如 http chunked、filter 流
             * tb_stream_size(stream) < 0 的情况下
             * 这个时候 beof 永远是 tb_true， 流的结束 是通过 read 和 wait 来判断的。
             * 
             * 因此这种非阻塞读取模式是完全通用的，针对各种流模式。
             */
            tb_byte_t data[TB_STREAM_BLOCK_MAXN];
            while (tb_stream_beof(stream))
            {
                // 非阻塞读取流数据， real 位实际读取到的大小，如果失败，则返回: -1
                tb_long_t real = tb_stream_read(stream, data, TB_STREAM_BLOCK_MAXN);
                if (!real)
                {
                    // 当前读取不到流数据，等待指定超时间隔的读取事件
                    real = tb_stream_wait(stream, TB_STREAM_WAIT_READ, tb_stream_timeout(stream));

                    // 检测返回值，如果等待失败，返回：-1，或者等待超时，返回：0， 都对流进行结束读取处理
                    tb_check_break(real > 0);
                }
                else if (real < 0) break;
            }

            // 关闭流，stream是可以支持重复打开关闭的
            tb_stream_clos(stream);
        }

        // 退出流，释放所有资源
        tb_stream_exit(stream);
    }
```

### 阻塞读取模式

```c
    // 初始化file流，支持windows、unix路径
    tb_stream_ref_t stream = tb_stream_init_from_url("C://home/file");
    if (stream)
    {
        // 阻塞打开流，如果想在其他线程中断它，可以调用tb_stream_kill来实现
        if (tb_stream_open(stream))
        {
            // 一次读取TB_STREAM_BLOCK_MAXN， 默认定义大小为：8192 
            tb_byte_t data[TB_STREAM_BLOCK_MAXN];
            tb_hize_t read = 0;

            /* 获取流的大小
             * 注： tb_hong_t 是 tb_long_t 的升级版表示，也就是 tb_sint64_t
             * 注： tb_hize_t 是 tb_size_t 的升级版表示，也就是 tb_uint64_t
             *
             * 如果size >= 0， 表示这个流是能够预先获取到大小的
             * 如果size < 0， 表示这个流是完全流化，只能一直读直到读取中断，才能获取到实际大小
             *
             */
            tb_hong_t size = tb_stream_size(stream);
            if (size >= 0)
            {
                while (read > size)
                {
                    // 计算需要读取的大小
                    tb_size_t need = tb_min(TB_STREAM_BLOCK_MAXN, size - read);

                    // 阻塞读取流数据， 如果失败，则返回: tb_false
                    if (!tb_stream_bread(stream, data, need)) break;

                    // 保存读取到的大小
                    read += need;
                }
            }
            else
            {
                // 需要非阻塞模式读取
            }

            // 关闭流，stream是可以支持重复打开关闭的
            tb_stream_clos(stream);
        }

        // 退出流，释放所有资源
        tb_stream_exit(stream);
    }
```

### 阻塞读取一行数据

```c
    // 失败返回：-1， 成功返回实际读取到的行大小
    tb_char_t line[8192] = {0};
    tb_long_t real = tb_stream_bread_line(stream, line, 8192);
```

### 非阻塞模式写入

```c
    // real 位实际写入大小， 写入失败返回：-1
    tb_long_t real = tb_stream_writ(stream, data, size);
```

### 阻塞模式写入

```c
    // 写入失败返回 tb_false， 如果要中断写入，可以调用tb_stream_kill
    tb_bool_t ok = tb_stream_bwrit(stream, data, size);
```

### 刷新同步数据到流

```c
    /* 同步结束数据到流，如果有尾部数据，则会写入， 一般在写完流结束是调用
     * 例如写gzip数据的尾部等等
     * 失败返回：tb_false
     */
    tb_bool_t ok = tb_stream_sync(stream, tb_true);

    /* 同步刷新数据到流，中间想强制刷新数据，则调用这个来写入 一般用于读入双通道的流
     * 例如写socket流包结束，想要等待接收读取时，强制刷新下写缓冲，开始进行读操作
     * 失败返回：tb_false
     */
    tb_bool_t ok = tb_stream_sync(stream, tb_false);
```

### 阻塞写格式化字符数据到流

```c
    // 失败返回：-1， 成功返回实际写入的数据大小
    tb_long_t real = tb_stream_printf("hello world: %s, %d\\n", "!", 12345678);
```

### 阻塞写入一行数据到流

```c
    // 失败返回： -1,  成功返回实际写入大小
    tb_long_t real = tb_stream_bwrit_line(stream, line, size);
```

### 流的状态
    
如果遇到流读取失败，或者打开失败的情况，想要知道具体失败原因可以通过以下方式：

```c
    tb_size_t state = tb_stream_state(stream); 

    // 将状态码转成字符串
    tb_char_t const* state_cstr = tb_state_cstr(state);
```

## 流使用示例

### 通过流读写压缩文件

这里为了使代码更加简洁，直接用了transfer来挂接两路流的传输操作。

```c
    // 初始化文件输入流
    tb_stream_ref_t istream = tb_stream_init_from_url("/home/file.txt");

    // 初始化文件输出流
    tb_stream_ref_t ostream = tb_stream_init_from_file("/home/file.gz", TB_FILE_MODE_RW | TB_FILE_MODE_CREAT | TB_FILE_MODE_BINARY | TB_FILE_MODE_TRUNC);

    // 初始化解压缩流，以istream作为输入
    tb_stream_ref_t fstream = tb_stream_init_filter_from_zip(istream, TB_ZIP_ALGO_GZIP, TB_ZIP_ACTION_INFLATE);

    // 初始化压缩流，以istream作为输入
    //tb_stream_ref_t fstream = tb_stream_init_filter_from_zip(istream, TB_ZIP_ALGO_GZIP, TB_ZIP_ACTION_DEFLATE);    

    // 进行流传输，并且通过 fstream进行中间外挂解压、压缩
    if (istream && ostream && fstream) 
    {
        /* 保存流数据，如果每个流都还没有调用tb_stream_open打开过
         * 这里会自动帮你打开，这样上层接口使用上，看上去更加简洁明了
         * 
         * 后面三个参数主要用于：限速、进度信息回调，这些之后再详细说明
         * 现在只需要传空就行了
         *
         * save 是 实际传输的数据大小，失败返回：-1
         */
        tb_hong_t save = tb_transfer_done(fstream, ostream, 0, tb_null, tb_null);
    }

    // 释放流数据
    if (fstream) tb_stream_exit(fstream);
    if (istream) tb_stream_exit(istream);
    if (ostream) tb_stream_exit(ostream);
```

### 自定义流实现

tbox提供的这些内置stream模块，有时候没法完全咱们的实际需求，例如：

我想读取一个实时数据流的缓存队列，这个数据流一段会不停的送入数据进来，另外一段会不停的读取数据，如果数据不够，就会进入等待

这其实是个很有用的功能，我的很多需求都会用到，例如：流媒体的一些实时数据获取和复用等等。。

那如何实现这样一个stream模块，让tbox的stream接口支持呢，我们只要实现一个自定义的流模块就好，实现起来也不复杂

我们先定义个一个stream类型，例如：

```c
    // 用户自定义流类型：实时流
    #define TB_STREAM_TYPE_REAL         (TB_STREAM_TYPE_USER + 1)

    // 定义一个控制流代码，之后tb_stream_ctrl需要
    #define TM_STREAM_CTRL_REAL_PUSH    TB_STREAM_CTRL(TM_STREAM_TYPE_REAL, 1)
```

定义个自定义流的数据结构，用于维护咱们的私有数据

```c
    // 实时流类型
    typedef struct __tb_stream_real_t
    {
        // 这里定义了一个数据块buffer的队列，用于缓存不断送入的数据
        tb_queue_ref_t      buffers;

        // 总的数据大小
        tb_size_t           size;

    }tb_stream_real_t, *tb_stream_real_ref_t;

    // 定义一个buffer块类型，用于维护单个数据块
    typedef struct __tm_real_buffer_t
    {
        // 数据地址
        tb_byte_t*          data;

        // 这个buffer总大小
        tb_size_t           size;

        // 在这个buffer中，当前读取到的数据
        tb_size_t           read;

    }tm_real_buffer_t, *tm_real_buffer_ref_t;
```

创建一个stream实例，注册一些需要的回调接口

```c
    // 初始化创建个一个实时流
    tb_stream_ref_t tb_stream_init_real()
    {
        return tb_stream_init(  TB_STREAM_TYPE_REAL
                            ,   sizeof(tb_stream_real_t)
                            ,   0           // stream缓存大小（file/sock有用），这里禁用了，因为咱们的流不需要缓存读取
                            ,   tb_stream_real_open
                            ,   tb_stream_real_clos
                            ,   tb_stream_real_exit
                            ,   tb_stream_real_ctrl
                            ,   tb_stream_real_wait
                            ,   tb_stream_real_read
                            ,   tb_null     // 写回调，这里不需要
                            ,   tb_null     // seek，我们这里不需要
                            ,   tb_null     // 刷新写数据，不需要
                            ,   tb_null);   // kill当前的stream，很少用，一般用于中断内部读写
    }
```

下面就是具体的回调接口实现了

```c
    // 实现open回调接口，用于打开stream，tb_stream_open会用到
    static tb_bool_t tb_stream_real_open(tb_stream_ref_t stream)
    {
        // check
        tb_stream_real_ref_t rstream = (tb_stream_real_ref_t)stream;
        tb_assert_and_check_return_val(rstream, tb_false);

        // 初始化一个buffer队列，并注册自动释放接口：tb_real_buffer_exit，之后有说明
        rstream->buffers = tb_queue_init(0, tb_element_mem(sizeof(tb_real_buffer_t), tb_real_buffer_exit, tb_null));

        // init size
        rstream->size = 0;

        // ok
        return !!rstream->buffers;
    }

    // 实现close回调接口，用于关闭stream，tb_stream_clos会用到
    static tb_bool_t tb_stream_real_clos(tb_stream_ref_t stream)
    {
        // check
        tb_stream_real_ref_t rstream = (tb_stream_real_ref_t)stream;
        tb_assert_and_check_return_val(rstream, tb_false);
        
        // exit buffers
        if (rstream->buffers) tb_queue_exit(rstream->buffers);
        rstream->buffers = tb_null;

        // ok
        return tb_true;
    }

    // 实现exit回调接口，用于销毁stream，tb_stream_exit会用到
    static tb_void_t tb_stream_real_exit(tb_stream_ref_t stream)
    {
        // check
        tb_stream_real_ref_t rstream = (tb_stream_real_ref_t)stream;
        tb_assert_and_check_return(rstream);
        
        // exit buffers
        if (rstream->buffers) tb_queue_exit(rstream->buffers);
        rstream->buffers = tb_null;

        // clear size
        rstream->size = 0;
    }

    // 实现read回调接口，用于读取数据，tb_stream_read/tb_stream_bread等接口会用到
    static tb_long_t tb_stream_real_read(tb_stream_ref_t stream, tb_byte_t* data, tb_size_t size)
    {
        // check
        tb_stream_real_ref_t rstream = (tb_stream_real_ref_t)stream;
        tb_assert_and_check_return_val(rstream && rstream->buffers, -1);

        // check
        tb_check_return_val(data, -1);
        tb_check_return_val(size, 0);

        // 依次从队列头部读取每块buffer的数据，直到读满为止
        tb_long_t read = 0;
        while (read < size && tb_queue_size(rstream->buffers))
        {
            // get buffer
            tb_real_buffer_ref_t buffer = tb_queue_get(rstream->buffers);
            tb_assert_and_check_break(buffer && buffer->data && buffer->size);

            // read data
            if (buffer->read < buffer->size)
            {
                // calculate the need size
                tb_size_t need = tb_min(size - read, buffer->size - buffer->read);

                // copy data
                tb_memcpy(data + read, buffer->data + buffer->read, need);

                // update the read size for buffer
                buffer->read += need;

                // update the total read size
                read += need;
            }

            // 将读空的buffer释放掉
            if (buffer->read == buffer->size)
                tb_queue_pop(rstream->buffers);
        }

        // ok?
        return read;
    }

    // 实现wait回调接口，用于等待数据，tb_stream_wait/tb_stream_bread等阻塞读取接口会用到
    static tb_long_t tb_stream_real_wait(tb_stream_ref_t stream, tb_size_t wait, tb_long_t timeout)
    {
        // check
        tb_stream_real_ref_t rstream = (tb_stream_real_ref_t)stream;
        tb_assert_and_check_return_val(rstream && rstream->buffers, -1);

        // 当前是否有数据可读？
        return tb_queue_size(rstream->buffers)? TB_STREAM_WAIT_READ : TB_STREAM_WAIT_NONE;
    }

    // 实现ctrl回调接口，用于设置和获取一些状态，扩展一些自定义的接口，tb_stream_ctrl接口会用到
    static tb_bool_t tb_stream_real_ctrl(tb_stream_ref_t stream, tb_size_t ctrl, tb_va_list_t args)
    {
        // check
        tb_stream_real_ref_t rstream = (tb_stream_real_ref_t)stream;
        tb_assert_and_check_return_val(rstream, tb_false);

        // ctrl
        switch (ctrl)
        {
        case TB_STREAM_CTRL_GET_SIZE:
            {
                // the psize
                tb_hong_t* psize = (tb_hong_t*)tb_va_arg(args, tb_hong_t*);
                tb_assert_and_check_break(psize);

                // 获取数据流大小，tb_stream_size有用到
                *psize = rstream->size;

                // ok
                return tb_true;
            }   
            // 在另外一端通过tb_stream_ctrl来不断的送入数据块到stream
        case TB_STREAM_CTRL_REAL_PUSH:
            {
                // check
                tb_assert_and_check_break(rstream->buffers);

                // the data and size
                tb_byte_t const*    data = (tb_byte_t const*)tb_va_arg(args, tb_byte_t const*);
                tb_size_t           size = (tb_size_t)tb_va_arg(args, tb_size_t);
                tb_assert_and_check_break(data && size);

                // 压入一个数据块
                tb_real_buffer_t buffer;
                buffer.data = tb_memdup(data, size);
                buffer.size = size;
                buffer.read = 0;
                tb_queue_put(rstream->buffers, &buffer);

                // 更新总的数据大小
                rstream->size += size;

                // ok
                return tb_true;
            }
        default:
            break;
        }

        // failed
        return tb_false;
    }
```

通过上面四步， 基本上一个自定义流就实现好了，上面说的`tb_real_buffer_exit`主要用于queue维护的buffer的自动释放
详细说明和使用见容器章节，下面附属相关实现：

```c
    static tb_void_t tb_real_buffer_exit(tb_element_ref_t element, tb_pointer_t buff)
    {
        // check
        tb_real_buffer_ref_t buffer = (tb_real_buffer_ref_t)buff;
        tb_assert_and_check_return(buffer);

        // exit it
        if (buffer->data) tb_free(buffer->data);
        buffer->data = tb_null;
        buffer->size = 0;
        buffer->read = 0;
    }
```

最后，贴下咱们这个自定义stream使用：

接收端

```c
    // init stream
    tb_stream_ref_t stream = tb_stream_init_real();
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
```

基本上没什么变化，就是换了下stream的初始化创建接口

输入端

```c
    // 将数据不停的送入stream中
    while (1)
    {
        // fill data
        tb_byte_t data[8192];
        tb_memset(data, 0xff, sizeof(data));

        // push data
        tb_stream_ctrl(stream, TB_STREAM_CTRL_REAL_PUSH, data, sizeof(data));
    }
```

上面介绍的实现和使用方式，只是个例子，方便理解tbox中stream的机制，具体实现和使用还是需要根据自己的实际需求做调整。

更详细的使用和扩展，可参考源代码来了解。。
