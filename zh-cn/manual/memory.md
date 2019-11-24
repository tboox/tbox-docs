## 内存整体架构

TBOX的内存管理模型，参考了linux kernel的内存管理机制，并在其基础上做了一些改进和优化。

![内存池架构](https://tboox.org/static/img/tbox/memorypool.png)

### 大块内存池：large_pool

整个内存分配的最底层，都是基于large_pool的大块内存分配池，类似于linux的基于page的分配管理，不过有所不同的是，large_pool并没有像linux那样使用buddy算法进行(2^N)*page进行分配，这样如果需要2.1m的内存，需要分配4m的内存块，这样粒度太大，非常浪费。

因此large_pool内部采用N*page的基于page_size为最小粒度进行分配，因此每次分配顶多浪费不到一页的空间。

而且如果需要的内存不到整页，剩下的内存也会一并返回给上层，如果上层需要（比如small_pool），可以充分利用这多余的部分内存空间，使得内存利用率达到最优化。

而且根据tb_init实际传入的参数需求，large_pool有两种模式：

1.  直接使用系统内存分配接口将进行大块内存的分配，并用双链维护，这种比较简单，就不多说了。
2.  在一大块连续内存上进行统一管理，实现内存分配。

具体使用哪种方式，根据应用需求，一般的应用只需要使用方式1就行了，这个时候tb_init传tb_null就行了，如果是嵌入式应用，需要管理有限的一块内存空间，这个时候可以使用方式2， tb_init传入指定内存空间地址和大小。

这里就主要看下方式2的large_pool的内存结构（假设页大小是4KB）：

```
     --------------------------------------------------------------------------
    |                                     data                                 |
     --------------------------------------------------------------------------
                                         |
     --------------------------------------------------------------------------
    | head | 4KB | 16KB | 8KB | 128KB | ... | 32KB |       ...       |  4KB*N  |
     --------------------------------------------------------------------------
```



由于large_pool主要用于大块分配，而超小块的分配在上层small_pool中已经被分流掉了，所以这个应用中，large_pool不会太过频繁的分配，所以碎片量不会太大，为了进一步减少碎片的产生，在free时候都会对下一个邻近的空闲块进行合并。而malloc在分配当前空闲块空间不够的情况下，也会尝试对下一个邻近空闲块进行合并。

由于每个内存块都是邻近挨着的，也没用双链维护，没有内存块，都有个块头，合并过程仅仅只是改动内存块头部的size字段，这样的合并不会影响效率。

由于没像buddy算法那样，用双链维护空闲内存，虽然节省了链表维护的空间和时间，但是每次分配内存都要顺序遍历所有块，来查找空闲的内存，这样的效率实在太低了，为了解决这个问题，large_pool内部针对不同级别的块，进行了预测，每次free或者malloc的时候，如果都会把当前和邻近的空闲快，缓存到对应级别的预测池里面去，具体的分级如下：

```
     --------------------------------------
    | >0KB :      4KB       | > 0*page     | 
    |-----------------------|--------------
    | >4KB :      8KB       | > 1*page     | 
    |-----------------------|--------------
    | >8KB :    12-16KB     | > 2*page     | 
    |-----------------------|--------------
    | >16KB :   20-32KB     | > 4*page     | 
    |-----------------------|--------------
    | >32KB :   36-64KB     | > 8*page     | 
    |-----------------------|--------------
    | >64KB :   68-128KB    | > 16*page    | 
    |-----------------------|--------------
    | >128KB :  132-256KB   | > 32*page    | 
    |-----------------------|--------------
    | >256KB :  260-512KB   | > 64*page    | 
    |-----------------------|--------------
    | >512KB :  516-1024KB  | > 128*page   | 
    |-----------------------|--------------
    | >1024KB : 1028-...KB  | > 256*page   | 
     --------------------------------------
```

由于通常不会分配太大块的内存，因此只要能够预测1m内存，就足够，而对于>1m的内存，这里也单独加了一个预测，来应对偶尔的超大块分配，并且使得整体分配流程更加的统一。

如果当前级别的预测块不存在，则会到下一级别的预测块中查找，如果都找不到，才会去遍历整个内存池。

实际测试下，每个块的预测成功基本都在95%以上，也就说大部分情况下，分配效率都是维持在O(1)级别的。

### 小块内存池：small_pool

小块内存分配池

在上层每次调用malloc进行内存分配的时候，会去判断需要多大的内存，如果这个内存超过或者等于一页，则会直接从large_pool进行分配，如果小于一页，则会优先通过small_pool进行分配，small_pool针对小块的内存进行了高速缓存，并优化了空间管理和分配效率。

由于程序大部分情况下，都在使用小块内存，因此small_pool对内存的分配做了很大的分流，使得large_pool承受的压力减小，碎片量减少很多，而small_pool内部由于都是由fixed_pool来对固定大小的内存进行管理，是不会存在外部碎片的。而小块内存的粒度本身就很小，所以内部碎片量也相当少。

small_pool中的fixed_pool，就像是linux kernel中的slub，在small_pool中总共有12级别的fixed_pool，每个级别分别管理一种固定大小的内存块，具体级别如下：

```
     --------------------------------------
    |    fixed pool: 16B    |  1-16B       | 
    |--------------------------------------|
    |    fixed pool: 32B    |  17-32B      |  
    |--------------------------------------|
    |    fixed pool: 64B    |  33-64B      | 
    |--------------------------------------|
    |    fixed pool: 96B*   |  65-96B*     | 
    |--------------------------------------|
    |    fixed pool: 128B   |  97-128B     |  
    |--------------------------------------|
    |    fixed pool: 192B*  |  129-192B*   |  
    |--------------------------------------|
    |    fixed pool: 256B   |  193-256B    |  
    |--------------------------------------|
    |    fixed pool: 384B*  |  257-384B*   |  
    |--------------------------------------|
    |    fixed pool: 512B   |  385-512B    |  
    |--------------------------------------|
    |    fixed pool: 1024B  |  513-1024B   |  
    |--------------------------------------|
    |    fixed pool: 2048B  |  1025-2048B  |  
    |--------------------------------------|
    |    fixed pool: 3072B* |  2049-3072B* |  
     -------------------------------------- 
```

其中 96B, 192B，384B，3072B并不是按2的整数幂大小，这么做主要是为了更加有效的利用小块内存的空间减少内部碎片。

### 固定块内存池：fixed_pool

顾名思义，fixed_pool就是用来管理固定大小的内存分配的，相当于linux中slub，而fixed_pool中又由多个slot组成，每个slot负责一块连续的内存空间，管理部分内存块的管理，类似linux中的slab， 每个slot由双链维护，并且参考linux的管理机制，分为三种slot管理方式：

1. 当前正在分配的slot
2. 部分空闲slots链表
3. 完全full的slots链表

具体结构如下：

```
    current:
         --------------
        |              |
     --------------    |
    |     slot     |<--
    |--------------|
    ||||||||||||||||  
    |--------------| 
    |              | 
    |--------------| 
    |              | 
    |--------------| 
    ||||||||||||||||  
    |--------------| 
    |||||||||||||||| 
    |--------------| 
    |              | 
     --------------  

    partial:

     --------------       --------------               --------------
    |     slot     | <=> |     slot     | <=> ... <=> |     slot     |
    |--------------|     |--------------|             |--------------|
    ||||||||||||||||     |              |             |              |
    |--------------|     |--------------|             |--------------|
    |              |     ||||||||||||||||             |              |
    |--------------|     |--------------|             |--------------|
    |              |     ||||||||||||||||             ||||||||||||||||
    |--------------|     |--------------|             |--------------|
    ||||||||||||||||     ||||||||||||||||             |              |
    |--------------|     |--------------|             |--------------|
    ||||||||||||||||     |              |             |              |
    |--------------|     |--------------|             |--------------|
    |              |     |              |             ||||||||||||||||
    --------------       --------------               --------------

    full:

     --------------       --------------               --------------
    |     slot     | <=> |     slot     | <=> ... <=> |     slot     |
    |--------------|     |--------------|             |--------------|
    ||||||||||||||||     ||||||||||||||||             ||||||||||||||||
    |--------------|     |--------------|             |--------------|
    ||||||||||||||||     ||||||||||||||||             ||||||||||||||||
    |--------------|     |--------------|             |--------------|
    ||||||||||||||||     ||||||||||||||||             ||||||||||||||||
    |--------------|     |--------------|             |--------------|
    ||||||||||||||||     ||||||||||||||||             ||||||||||||||||
    |--------------|     |--------------|             |--------------|
    ||||||||||||||||     ||||||||||||||||             ||||||||||||||||
    |--------------|     |--------------|             |--------------|
    ||||||||||||||||     ||||||||||||||||             ||||||||||||||||
     --------------       --------------               --------------
```

**具体的分配算法**

1. 如果当前slot中还有空闲的块，优先从当前slot进行分配
2. 如果当前slot中没有空闲块，则把这个slot放到full链表中去
3. 从部分空闲slot链表中，挑一个空闲的slot进行分配，并把它设为当前分配状态。

**具体的释放算法**

1. 释放后如果这个slot完全空闲了，并且不是正在分配的slot，则把整个slot释放掉，这样既可以保证有一个可以分配的slot之外，还极大的降低了内存使用，也避免某些情况下频繁的释放分配slot。
2. 如果释放的slot属于full链表并且变为了部分空闲，则把这个slot移到部分空闲slot链表中去。

**额外要提一下的是**：

large_pool每次分配一块空间给一个slot的时候，残留下来的部分剩余空间(<1*page)， 也能直接返回给slot，让slot充分利用这部分数据，这样可以可以切分出更多地内存块。

例如： 

fixed_pool每次增长一个包含256个32B内存块的slot（需要8192B大小+16B内部数据维护大小），其实在用large_pool分配的时候，需要8208B的大小，由于需要按页对齐（4KB），实际分配确占用了`8192+4096: 12288B`的大小的空间。

但是large_pool支持把所有空间数据一并返回给上层，这样slot其实获取到了一个12288B大小的内存，并且也知道其实际大小为：12288B，因此实际切分了`(12288-(32B的slot内部维护数据))/32`也就是383个内存块。 

多维护了127个内存块，充分把large_pool的内部碎片也利用上了，进一步增加了内存利用率。

### fixed_pool中的slot

虽然类比与linux中的slab，但是其数据结构确跟slab不太一样，它并没有像slab那样，对每个空闲小块都用链表维护，而是直接用位段来维护是否空闲的信息，这样更加节省内存，而且通过优化算法，其分配效率和slab几乎一样。

在fixed_pool的slot的头部，专门有一小块独立的数据，用于维护每个小块的空闲信息，每个块只暂用一比特位的信息，来判断这个块是否空闲，由于没有内存块都是固定大小的，所以比特位的位置定位，完全可以通过索引计算得到。

而且每次释放和分配，都会去缓存一个双字大小的位信息端，来预测下一次的分配，由于是双字大小，总共有32个比特位，所以每次缓存，最多可以预测邻近32个内存块。因此大部分情况下，预测成功率一直都是>98%的，分配效率都维持在O(1)，比起large_pool的预测率还高很多，所以small_pool对large_pool的分流，还在一定程度上，进一步提高了内存分配效率。

而就算很倒霉，没预测成功，slot的顺序遍历来查找空闲快的算法，也相当高效，完全是高度优化的，下面就详细描述下。

#### slot的顺序遍历分配算法优化

我们这里主要用到了gcc的几个内置函数：

1. __builtin_clz：计算32位整数前导0的个数
2. __builtin_ctz：计算32位整数后置0的个数
3. __builtin_clzll：计算64位整数前导0的个数
4. __builtin_ctzll：计算64位整数后置0的个数

其实这四个类似，我们这里就拿第一说明好了，为什么要使用__builtin_clz呢？其实就是为了在一个32位端里面，快速查找某个空闲位的索引，这样就能快速定位某个空闲块的位置了。

比如有一个32位的位段信息整数：x，计算对应空闲位0的索引，主需要：`__builtin_clz(~x)`

简单吧，由于__builtin_clz这些内置函数，gcc用汇编针对不同平台高度优化过的，计算起来相当的快，那如果不是gcc的编译器怎么办呢？

没关系，我们可以自己用c实现个优化版本的，当然完全可以汇编继续优化，这里就先给个c的实现：

```c
    static __tb_inline__ tb_size_t tb_bits_cl0_u32_be_inline(tb_uint32_t x)
    {
        // check
        tb_check_return_val(x, 32);

        // done
        tb_size_t n = 31;
        if (x & 0xffff0000) { n -= 16;  x >>= 16;   }
        if (x & 0xff00)     { n -= 8;   x >>= 8;    }
        if (x & 0xf0)       { n -= 4;   x >>= 4;    }
        if (x & 0xc)        { n -= 2;   x >>= 2;    }
        if (x & 0x2)        { n--;                  }
        return n;
    }
```

说白了，就是每次对半开，来减少判断次数，比起每次一位一位的枚举遍历，这种已经是相当高效了，更何况还有__builtin_clz呢。

**接下来就看下具体的遍历过程：**

1. 按4/8字节对齐位段的起始地址
2. 每次按4/8字节遍历位段数据，遍历过程利用cpu cache的大小，针对性的做循环展开，来优化性能。
3. 通过判断 !(x + 1) 来快速过滤 0xffffffff 这些已经满了的位段，进一步提高遍历效率。
4. 如果某个位段不是0xffffffff，则通过__builtin_clz(~x)计算实际的空闲块索引，并进行实际的分配。
5. 最后如果这个的32位的位段没有被分配满，可以把它进行缓存，来为下次分配做预测。

### 字符串内存池：string_pool

讲到这，TBOX的内存池管理模型，基本算是大概讲完了，这里就简单提下string_pool，即：字符串池

string_pool主要针对上层应用而言的，针对某些频繁使用小型字符串，并且重复率很高的模块，就可以通过string_pool进行优化，进一步减少内存使用，string_pool内部通过引用计数+哈希表维护，针对相同的字符串只保存一份。

例如可以用于cookies中字符串维护、http中header部分的字符串维护等等。。

## 切换全局的内存分配器

tbox的默认内存分配，是完全基于自己的内存池架构，支持内存的快速分配，和对碎片的优化，并且支持各种内存泄露、溢出检测。

如果不想用tbox内置的默认内存分配管理，也可以灵活切换到其他分配模式，因为tbox现在已经完全支持allocator架构，
只要在init阶段传入不同的分配器模型，就能快速切换分配模式，例如：

### 默认内存分配器

tbox默认的初始化采用了默认的tbox内存管理，他会默认启用内存池维护、碎片优化、内存泄露溢出检测等所有特性。

```c
tb_init(tb_null, tb_null);
```

上面的初始化等价于：

```c
tb_init(tb_null, tb_default_allocator(tb_null, 0));
```

默认的分配器，通常情况下都会直接调用系统malloc使用系统原生native内存，只是在此基础上多了层内存管理和内存检测支持，如果想要在一块连续内存上完全托管，可以使用下面的方式：

```c
tb_init(tb_null, tb_default_allocator((tb_byte_t*)malloc(300 * 1024 * 1024), 300 * 1024 * 1024));
```

### 静态内存分配器

我们也可以直接采用一整块静态buffer上进行维护，启用内存泄露溢出检测等所有特性，这个跟tb_default_allocator的区别就是，
这个分配器比较轻量，内部的数据结构简单，占用内存少，适合低资源环境，比如在一些嵌入式环境，用这个分配器资源利用率更高些。

!> 但是这个allocator不支持碎片优化，容易产生碎片。


```c
tb_init(tb_null, tb_static_allocator((tb_byte_t*)malloc(300 * 1024 * 1024), 300 * 1024 * 1024));
```

### 原生内存分配器

完全使用系统native内存分配，内部不做任何处理和数据维护，所有特性依赖系统环境，所以内存池和内存检测等特性也是不支持的，相当于直接透传给了malloc等系统分配接口。

用户可以根据自己的需要，如果不想使用tbox内置的内存池维护，就可以使用此分配器。

```c
tb_init(tb_null, tb_native_allocator());
```

### 虚拟内存分配器

v1.6.4版本之后，tbox新提供了一种分配器类型：虚拟内存分配器，主要用来分配一些超大块的内存。

通常，用户并不需要它，因为tbox默认的内存分配器内部自动会对超大块的内存块，切换到虚拟内存池去分配，不过如果用户想要强制切换到虚拟内存分配，也可以通过下面的方式切换使用：

```c
tb_init(tb_null, tb_virtual_allocator());
```

### 自定义内存分配器

如果觉得这些分配器还是不够用，可以自定义自己的内存分配器，让tbox去使用，自定义的方式也很简单，这里拿`tb_native_allocator`的实现代码为例：

```c
static tb_pointer_t tb_native_allocator_malloc(tb_allocator_ref_t allocator, tb_size_t size __tb_debug_decl__)
{
    // trace
    tb_trace_d("malloc(%lu) at %s(): %lu, %s", size, func_, line_, file_);

    // malloc it
    return malloc(size);
}
static tb_pointer_t tb_native_allocator_ralloc(tb_allocator_ref_t allocator, tb_pointer_t data, tb_size_t size __tb_debug_decl__)
{
    // trace
    tb_trace_d("realloc(%p, %lu) at %s(): %lu, %s", data, size, func_, line_, file_);

    // realloc it
    return realloc(data, size);
}
static tb_bool_t tb_native_allocator_free(tb_allocator_ref_t allocator, tb_pointer_t data __tb_debug_decl__)
{
    // trace    
    tb_trace_d("free(%p) at %s(): %lu, %s", data, func_, line_, file_);

    // free it
    return free(data);
}
```

然后我们初始化下咱们自己实现的native分配器：

```c
tb_allocator_t myallocator    = {0};
myallocator.type              = TB_ALLOCATOR_NATIVE;
myallocator.malloc            = tb_native_allocator_malloc;
myallocator.ralloc            = tb_native_allocator_ralloc;
myallocator.free              = tb_native_allocator_free;
```

是不是很简单，需要注意的是，上面的`__tb_debug_decl__`宏里面声明了一些debug信息，例如`_file, _func, _line`等内存分配时候记录的信息，
你可以在debug的时候打印出来，做调试，也可以利用这些信息自己去处理一些高级的内存检测操作，但是这些在release下，是不可获取的

所以处理的时候，需要使用`__tb_debug__`宏，来分别处理。。

将myallocator传入`tb_init`接口后，之后 `tb_malloc/tb_ralloc/tb_free/...` 等所有tbox内存分配接口都会切到新的allocator上进行分配。。

```c
tb_init(tb_null, &myallocator);
```

当然如果想直接从一个特定的allocator上进行分配，还可以直接调用allocator的分配接口来实现：

```c
tb_allocator_malloc(&myallocator, 10);
tb_allocator_ralloc(&myallocator, data, 100);
tb_allocator_free(&myallocator, data);
```

## 内存分配接口

### 数据分配接口

此类接口可以直接分配内存数据，不过返回的是`tb_pointer_t`类型数据，通过用户需要自己做类型强转才能访问。

!> 其中malloc0这种后缀带0字样的接口，分配的内存会自动做内存清0操作。

```c
tb_free(data)                               
tb_malloc(size)                             
tb_malloc0(size)                            
tb_nalloc(item, size)                       
tb_nalloc0(item, size)                      
tb_ralloc(data, size)                       
```

### 字符串分配接口

tbox也提供了字符串类型的便捷分配，操作的数据类型直接就是`tb_char_t*`，省去了额外的强转过程。

```
tb_malloc_cstr(size)                        
tb_malloc0_cstr(size)                       
tb_nalloc_cstr(item, size)                  
tb_nalloc0_cstr(item, size)                 
tb_ralloc_cstr(data, size)                  
```

### 字节数据分配接口

这个也是数据分配接口，唯一的区别就是，默认做了`tb_byte_t*`类型的强转处理，访问数据读写访问。

```c
tb_malloc_bytes(size)                       
tb_malloc0_bytes(size)                      
tb_nalloc_bytes(item, size)                 
tb_nalloc0_bytes(item, size)                
tb_ralloc_bytes(data, size)                 
```

### struct结构数据分配接口

如果要分配一些struct数据，那么此类接口自带了struct类型强转处理。

```c
tb_malloc_type(type)                        
tb_malloc0_type(type)                       
tb_nalloc_type(item, type)                  
tb_nalloc0_type(item, type)                 
tb_ralloc_type(data, item, type)      
```

使用方式如下：

```c
typedef struct __xxx_t
{
    tb_int_t dummy;

}xxx_t;

xxx_t* data = tb_malloc0_type(xxx_t);
if (data)
{
    data->dummy = 0;
    tb_free(data);
}
```

可以看到，我们省去了类型转换过程，所以这是个提供一定便利性的辅助接口。

### 地址对齐数据分配接口

如果我们有时候要求分配出来的内存数据地址，必须是按照指定大小对齐过的，就可以使用此类接口：

```c
tb_align_free(data)                         
tb_align_malloc(size, align)                
tb_align_malloc0(size, align)               
tb_align_nalloc(item, size, align)          
tb_align_nalloc0(item, size, align)         
tb_align_ralloc(data, size, align) 
```

例如：

```c
tb_pointer_t data = tb_align_malloc(1234, 16);
```

实际分配出来的data数据地址是16字节对齐的。

如果是按8字节对齐的内存数据分配，也可以通过下面的接口来分配，此类接口对64bits系统上做了优化，并没做什么特殊处理：

```c
#if TB_CPU_BIT64
#   define tb_align8_free(data)                     tb_free((tb_pointer_t)data)
#   define tb_align8_malloc(size)                   tb_malloc(size)
#   define tb_align8_malloc0(size)                  tb_malloc0(size)
#   define tb_align8_nalloc(item, size)             tb_nalloc(item, size)
#   define tb_align8_nalloc0(item, size)            tb_nalloc0(item, size)
#   define tb_align8_ralloc(data, size)             tb_ralloc((tb_pointer_t)data, size)
#else
#   define tb_align8_free(data)                     tb_align_free((tb_pointer_t)data)
#   define tb_align8_malloc(size)                   tb_align_malloc(size, 8)
#   define tb_align8_malloc0(size)                  tb_align_malloc0(size, 8)
#   define tb_align8_nalloc(item, size)             tb_align_nalloc(item, size, 8)
#   define tb_align8_nalloc0(item, size)            tb_align_nalloc0(item, size, 8)
#   define tb_align8_ralloc(data, size)             tb_align_ralloc((tb_pointer_t)data, size, 8)
#endif
```

## 内存检测

TBOX的内存分配在调试模式下，可以检测支持内存泄露和越界，而且还能精确定位到出问题的那块内存具体分配位置，和函数调用堆栈。 

要使用tbox的内存检测功能，只需要切换到debug模式编译：

```bash
$ xmake f -m debug
$ xmake
```

### 内存泄露检测

!> 泄露检测，必须在程序完整退出，确保调用了`tb_exit()`接口后才能触发检测。

内存泄露的检测必须在程序退出的前一刻，调用tb_exit()的时候，才会执行，如果有泄露，会有详细输出到终端上。
    
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

### 内存越界检测

越界溢出的检测，是实时完成的，而且对libc也做了插桩，所以对常用strcpy，memset等的使用，都会去检测

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

### 内存重叠覆盖检测

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

### 内存双重释放检测

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
