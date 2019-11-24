## Memory overall architecture

TBOX's memory management model, reference to the memory management mechanism of the Linux kernel, and made some improvements and optimizations based on it.

![Memory Pool Architecture] (https://tboox.org/static/img/tbox/memorypool.png)

### Large memory pool: large_pool

The bottom of the entire memory allocation is based on large_pool large memory allocation pool, similar to Linux's page-based allocation management, but the difference is that large_pool does not use buddy algorithm like Linux (2^N) *page is allocated, so if you need 2.1m of memory, you need to allocate 4m of memory blocks, so the strength is too big, very wasteful.

Therefore, the large_pool internally uses N*page to allocate the minimum size based on page_size, so less than one page of space is wasted each time.

And if the required memory is less than the entire page, the remaining memory will be returned to the upper layer. If the upper layer needs (such as small_pool), you can make full use of this extra memory space to optimize the memory utilization.

And according to the actual incoming parameter requirements of tb_init, large_pool has two modes:

1. Direct use of the system memory allocation interface will allocate large blocks of memory, and maintain with double-chain, this is relatively simple, not much to say.
2. Unified management on a large contiguous memory to achieve memory allocation.

Which method to use, according to the application requirements, the general application only needs to use the mode 1 on the line, this time tb_init pass tb_null on the line, if it is an embedded application, you need to manage a limited piece of memory space, this time you can use mode 2, Tb_init passes in the specified memory space address and size.

Here we mainly look at the memory structure of the large_pool of mode 2 (assuming the page size is 4KB):

```
     --------------------------------------------------------------------------
    |                                     data                                 |
     --------------------------------------------------------------------------
                                         |
     --------------------------------------------------------------------------
    | head | 4KB | 16KB | 8KB | 128KB | ... | 32KB |       ...       |  4KB*N  |
     --------------------------------------------------------------------------
```

Since large_pool is mainly used for large block allocation, and the allocation of ultra-small blocks has been split in the upper small_pool, this application, large_pool will not be allocated too frequently, so the amount of fragmentation will not be too large, in order to further reduce The generation of fragments, when free, will merge the next adjacent free block. While malloc allocates the current free block space, it will try to merge the next adjacent free block.

Since each memory block is adjacent to it, there is no double-chain maintenance, no memory block, and there is a block header. The merge process only changes the size field of the memory block header. Such a merge does not affect the efficiency.

Since there is no double-chain maintenance of free memory like the buddy algorithm, although the space and time for the maintenance of the linked list are saved, each time the memory is allocated, all the blocks are sequentially traversed to find the free memory, which is too low efficiency. In order to solve this problem, large_pool internally predicts different levels of blocks. Each time free or malloc, if the current and neighboring idles are fast, they are cached into the prediction pool of the corresponding level. The specific classification is as follows:

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

Since it is usually not allocated too much memory, it is sufficient to be able to predict 1m of memory, and for >1m of memory, a separate prediction is added here to cope with occasional oversized allocations and to make the overall allocation process more Unity.

If the current level of the prediction block does not exist, it will go to the next level of the prediction block to find, if not found, then go back and traverse the entire memory pool.

Under the actual test, the prediction success of each block is basically above 95%, which means that in most cases, the distribution efficiency is maintained at the O(1) level.

### Small block memory pool: small_pool

Small memory allocation pool

Whenever the upper layer calls malloc for memory allocation, go back and judge how much memory is needed. If the memory exceeds or equals one page, it will be allocated directly from large_pool. If it is less than one page, it will be allocated first through small_pool, small_pool Caches small chunks of memory and optimizes space management and allocation efficiency.

Since most of the programs use small blocks of memory, the small_pool allocates a lot of memory, which reduces the pressure on the large_pool and reduces the amount of fragmentation. The small_pool is internally fixed by the fixed_pool. Fixed-size memory is managed without external fragmentation. The granularity of the small block memory itself is small, so the amount of internal fragmentation is also quite small.

The fixed_pool in small_pool is like a slub in the Linux kernel. There are 12 fixed_pools in the small_pool. Each level manages a fixed-size memory block. The specific levels are as follows:

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

Among them, 96B, 192B, 384B, and 3072B are not based on the integer power of 2. This is mainly to reduce the internal fragmentation by using the space of small block memory more effectively.

### Fixed block memory pool: fixed_pool

As the name implies, fixed_pool is used to manage fixed-size memory allocation, which is equivalent to slub in linux, and fixed_pool is composed of multiple slots. Each slot is responsible for a contiguous memory space, managing the management of some memory blocks, similar to linux. Slab, each slot is maintained by double-chain, and with reference to the Linux management mechanism, it is divided into three types of slot management:

1. The slot currently being allocated
2. Partial free slots list
3. Fully full chain list

The specific structure is as follows:

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

**Specific allocation algorithm**

1. If there are still free blocks in the current slot, the allocation is prioritized from the current slot.
2. If there is no free block in the current slot, put this slot in the full list.
3. From the partial free slot list, pick an idle slot for allocation and set it to the current allocation state.

**Specific release algorithm**

1. After the release, if the slot is completely idle, and it is not the slot being allocated, then the entire slot is released, so that it can ensure that there is a slot that can be allocated, and the memory usage is greatly reduced, and some In some cases, the allocation slot is frequently released.
2. If the released slot belongs to the full list and becomes partially idle, move the slot to the partial free slot list.

** Extra mention is **:

When large_pool allocates a space to a slot each time, the remaining part of the remaining space (<1*page) can also be directly returned to the slot, so that the slot can make full use of this part of the data, so that more memory can be segmented. Piece.

E.g: 

Fixed_pool grows a slot containing 256 32B memory blocks at a time (requires 8192B size +16B internal data maintenance size). In fact, when using large_pool allocation, it needs 8208B size. Because it needs to be page aligned (4KB), the actual allocation is indeed Take up the space of `8192+4096: 12288B`.

But large_pool supports returning all the spatial data to the upper layer, so the slot actually gets a 12288B size memory, and also knows its actual size is: 12288B, so the actual split is `(12288-(32B slot internal maintenance data) )) / 32 ` is 383 memory blocks.

More than 127 memory blocks have been maintained, and the internal fragment of large_pool has been fully utilized, further increasing memory utilization.

### slot in fixed_pool

Although the analogy and slab in linux, but its data structure is not the same as slab, it does not like the slab, for each idle small block is maintained with a linked list, but directly with the bit segment to maintain the information of idle, This saves memory, and by optimizing the algorithm, its allocation efficiency is almost the same as slab.

At the head of the fixed_pool slot, there is a small piece of independent data for maintaining the idle information of each small block. Each block temporarily uses only one bit of information to determine whether the block is free, because there is no memory block. They are all fixed size, so the positional positioning of the bits can be calculated by index.

And each release and allocation, will cache a double word size bit information to predict the next allocation, because it is double word size, there are a total of 32 bits, so each cache can predict up to 32 adjacent Memory block. Therefore, in most cases, the prediction success rate is always >98%, the allocation efficiency is maintained at O(1), which is much higher than the prediction rate of large_pool, so the shunt of small_pool to large_pool is still to a certain extent. Further improve the memory allocation efficiency.

Even if it is unlucky, it is not predicted to be successful, the order of the slot is traversed to find the algorithm that is idle and fast, and it is quite efficient and completely highly optimized, as described in detail below.

#### slot's sequential traversal allocation algorithm optimization

Here we mainly use several built-in functions of gcc:

1. __builtin_clz: Calculate the number of leading zeros for 32-bit integers
2. __builtin_ctz: Calculate the number of 0s after a 32-bit integer
3. __builtin_clzll: Calculate the number of leading 0s of 64-bit integers
4. __builtin_ctzll: Calculate the number of 0s after a 64-bit integer

In fact, these four are similar. Let's take the first explanation here. Why use __builtin_clz? In fact, in order to quickly find the index of a free bit in a 32-bit end, you can quickly locate the location of a free block.

For example, there is a 32-bit bit segment information integer: x, which calculates the index corresponding to the idle bit 0. The main need: `__builtin_clz(~x)`

Simple, because of the built-in functions of __builtin_clz, gcc is highly optimized for assembly on different platforms, and it is quite fast to calculate. What if it is not a gcc compiler?

It doesn't matter, we can use c to achieve an optimized version. Of course, we can compile and continue to optimize. Here we will give an implementation of c:

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

To put it bluntly, it is half-opening each time to reduce the number of judgments. This is quite efficient compared to one-bit enumeration traversal each time, not to mention __builtin_clz.

**Next look at the specific traversal process: **

1. Align the start address of the bit segment by 4/8 byte
2. Each time the bit segment data is traversed by 4/8 bytes, the traversal process uses the size of the cpu cache to perform a loop expansion specifically to optimize performance.
3. Quickly filter the 0xffffffff bits that are already full by judging !(x + 1) to further improve traversal efficiency.
4. If a bit segment is not 0xffffffff, the actual free block index is calculated by __builtin_clz(~x) and the actual allocation is made.
5. Finally, if this 32-bit bit segment is not fully allocated, it can be cached to make predictions for the next allocation.

### String memory pool: string_pool

Speaking of this, TBOX's memory pool management model, the basic calculation is probably finished, here is simply to mention the string_pool, namely: string pool

String_pool is mainly for upper-layer applications. For some modules that use small strings frequently and have a high repetition rate, they can be optimized by string_pool to further reduce memory usage. String_pool is internally maintained by reference counting + hash table. Only one copy of the same string is saved.

For example, it can be used for string maintenance in cookies, string maintenance in the header part of http, and so on. .

## Switching the global memory allocator

Tbox's default memory allocation is based entirely on its own memory pool architecture, support for fast memory allocation, and optimization of fragmentation, and supports a variety of memory leaks, overflow detection.

If you don't want to use the default memory allocation management built into tbox, you can also switch to other allocation modes flexibly, because tbox now fully supports the allocator architecture.
As long as you pass in different distributor models in the init phase, you can quickly switch the allocation mode, for example:

### Default memory allocator

The default initialization of tbox uses the default tbox memory management. It will enable all features such as memory pool maintenance, fragment optimization, and memory leak overflow detection by default.

```c
tb_init(tb_null, tb_null);
```

The above initialization is equivalent to:

```c
tb_init(tb_null, tb_default_allocator(tb_null, 0));
```

The default allocator, usually directly call the system malloc to use the system native native memory, just based on this layer of additional memory management and memory detection support, if you want to fully host on a contiguous memory, you can use the following way :

```c
tb_init(tb_null, tb_default_allocator((tb_byte_t*)malloc(300 * 1024 * 1024), 300 * 1024 * 1024));
```

### Static Memory Allocator

We can also directly use a whole block of static buffer for maintenance, enable all features such as memory leak overflow detection, this difference with tb_default_allocator is,
This allocator is relatively lightweight, the internal data structure is simple, takes up less memory, and is suitable for low resource environments. For example, in some embedded environments, the resource utilization rate of this allocator is higher.

!> But this allocator does not support fragment optimization and is prone to fragmentation.


```c
tb_init(tb_null, tb_static_allocator((tb_byte_t*)malloc(300 * 1024 * 1024), 300 * 1024 * 1024));
```

### Native Memory Splitter

Full use of the system native memory allocation, no internal processing and data maintenance, all features depend on the system environment, so memory pool and memory detection and other features are not supported, equivalent to direct pass to malloc and other system distribution interface.

Users can use this allocator if they don't want to use the built-in memory pool maintenance of tbox.

```c
tb_init(tb_null, tb_native_allocator());
```

### Virtual Memory Allocator

After v1.6.4, tbox provides a new type of allocator: virtual memory allocator, mainly used to allocate some large chunks of memory.

Usually, the user does not need it, because the default memory allocator of the tbox automatically switches to the virtual memory pool to allocate to the hyper-large memory block, but if the user wants to force the switch to the virtual memory allocation, it can also pass the following Mode switching use:

```c
Tb_init(tb_null, tb_virtual_allocator());
```

### Custom Memory Allocator

If you think that these allocators are not enough, you can customize your own memory allocator, let tbox use, the custom way is also very simple, here take the implementation code of `tb_native_allocator` as an example:

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

Then we initialize the native allocator we implement ourselves:

```c
tb_allocator_t myallocator    = {0};
myallocator.type              = TB_ALLOCATOR_NATIVE;
myallocator.malloc            = tb_native_allocator_malloc;
myallocator.ralloc            = tb_native_allocator_ralloc;
myallocator.free              = tb_native_allocator_free;
```

Is it very simple, it should be noted that the above `__tb_debug_decl__` macro declares some debugging information, such as `_file, _func, _line` and other information recorded during memory allocation.
You can print it out during debugging, do debugging, or use this information to handle some advanced memory detection operations yourself, but these are not available under release.

So when processing, you need to use the `__tb_debug__` macro to handle them separately. .

After passing myallocator to the `tb_init` interface, all tbox memory allocation interfaces such as `tb_malloc/tb_ralloc/tb_free/...` will be switched to the new allocator for allocation. .

```c
tb_init(tb_null, &myallocator);
```

Of course, if you want to allocate directly from a specific allocator, you can also directly call the allocator's allocation interface to achieve:

```c
tb_allocator_malloc(&myallocator, 10);
tb_allocator_ralloc(&myallocator, data, 100);
tb_allocator_free(&myallocator, data);
```

## Memory Allocation Interface

### Data Distribution Interface

This type of interface can directly allocate memory data, but returns the `tb_pointer_t` type data, which can be accessed by the user who needs to do the type of strong transfer.

!> Among them malloc0 this suffix with 0 typeface interface, the allocated memory will automatically do memory clear 0 operation.

```c
tb_free(data)                               
tb_malloc(size)                             
tb_malloc0(size)                            
tb_nalloc(item, size)                       
tb_nalloc0(item, size)                      
tb_ralloc(data, size)                       
```

### String allocation interface

Tbox also provides a convenient assignment of string types. The data type of the operation is directly `tb_char_t*`, which eliminates the extra strong process.

```
tb_malloc_cstr(size)                        
tb_malloc0_cstr(size)                       
tb_nalloc_cstr(item, size)                  
tb_nalloc0_cstr(item, size)                 
tb_ralloc_cstr(data, size)                  
```

### Byte data distribution interface

This is also the data distribution interface, the only difference is that by default the `tb_byte_t*` type of strong processing, access data read and write access.

```c
tb_malloc_bytes(size)
tb_malloc0_bytes(size)
tb_nalloc_bytes(item, size)
tb_nalloc0_bytes(item, size)
tb_ralloc_bytes(data, size)
```

### struct structure data distribution interface

If you want to allocate some struct data, then this type of interface comes with a struct type to force processing.

```c
tb_malloc_type(type)
tb_malloc0_type(type)
tb_nalloc_type(item, type)
tb_nalloc0_type(item, type)
tb_ralloc_type(data, item, type)
```

The usage is as follows:

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

As you can see, we have omitted the type conversion process, so this is an auxiliary interface that provides some convenience.

### Address Alignment Data Distribution Interface

If we sometimes ask for the allocated memory data address, it must be aligned to the specified size, you can use this type of interface:

```c
tb_align_free(data)                         
tb_align_malloc(size, align)                
tb_align_malloc0(size, align)               
tb_align_nalloc(item, size, align)          
tb_align_nalloc0(item, size, align)         
tb_align_ralloc(data, size, align) 
```

For example:

```c
tb_pointer_t data = tb_align_malloc(1234, 16);
```

The actual allocated data data address is 16 byte aligned.

If the 8-byte-aligned memory data is allocated, it can also be assigned through the following interface. This type of interface is optimized on the 64bits system and does nothing special:

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

## Memory Detection

TBOX's memory allocation in debug mode can detect memory leaks and out of bounds, and can also pinpoint the location of the memory where the problem is located, and the function call stack.

To use the memory detection feature of tbox, you only need to switch to debug mode to compile:

```bash
$ xmake f -m debug
$ xmake
```

### Memory leak detection

!> Leak detection, you must exit the program completely, make sure that the `tb_exit()` interface is called before the detection can be triggered.

The detection of memory leaks must be executed when tb_exit() is called immediately before the program exits. If there is a leak, it will be output to the terminal in detail.    

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

### Memory out of bounds detection

The detection of the out-of-boundary overflow is done in real time, and the libc is also instrumented, so the use of commonly used strcpy, memset, etc., is back to detect

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

### Memory Overlap Cover Detection

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

### Memory double release detection

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
