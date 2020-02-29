
## v1.6.5

### New features

* [#112](https://github.com/tboox/tbox/issues/112): Support unix socket，thanks [@Codehz](https://github.com/codehz)
* Support to wait pipe, socket and process in coroutine and poller at same time

### Changes

* improve uuid and improve uuid v4
* support msys/mingw and cygwin/gcc toolchains

## v1.6.4

### New features

* [#70](https://github.com/tboox/tbox/issues/70): Add `tb_stream_init_from_sock_ref()` to open a given socket as stream
* Add stdfile api to read/write stdin, stdout and stderr.
* [#81](https://github.com/tboox/tbox/issues/81): Add set/get thread/process cpu affinity 
* Add filelock api
* Add anonymous and named pipe

### Changes

* Optimize queue_buffer module
* Improve stream interfaces
* Improve charset encoding and add ANSI support
* Improve atomic and add c11-like atomic apis
* Improve spinlock
* Support to redirect process output to pipe 
* Uses virtual memory for coroutine stack
* Improve openssl/mbedtls for https

## v1.6.3

### New features

* [#24](https://github.com/tboox/tbox/issues/24): Support IOCP for coroutine on windows

### Changes

* Move docs directory to tbox-docs repo
* Support tinyc compiler
* Remove deprecated module (asio), please use coroutine module
* Improve memory for container
* Help valgrind to understand coroutines

### Bugs fixed

* Fix the charset problem of envirnoment variables
* Fix process exit bug
* Fix setenv empty value crash 
* Fix coroutine.sleep bug
* Fix windows root path bug 
* Fix thread local memory leak
* Fix context bug for coroutine
* Fix `tb_vsnprintf` overflow 
* [#43](https://github.com/tboox/tbox/issues/43): Fix read dns server and stream bug

## v1.6.2

### New features

* Add ping demo for network

### Changes

* Modify license to Apache License 2.0
* Rename `--smallest=y|n` option to `--small=y|n`
* Support stat64
* Improve copy speed and fix permissions for `tb_file_copy`
* Improve path operation for posix platform
* Improve socket interfaces and support icmp

### Bugs fixed

* Fix create file mode to 0644
* Fix file and directory path bug
* Fix remove directory with dead symbol link failed
* Fix remove readonly file failed
* [#34](https://github.com/tboox/tbox/issues/34): Fix cache time and coroutine sleep bug
* [#35](https://github.com/tboox/tbox/issues/35): Fix epoll bug with the edge trigger mode

## v1.6.1

### New features

* Support coroutine context switch for mips
* Add `__tb_thread_local__` keyword macro
* Add `--micro=y|n` option to compiling micro library (~64K) for the embed system
* Add `tb_addrinfo_addr` and `tb_addrinfo_name` interfaces
* Add stackless coroutine
* Add semaphone and lock for the stackless coroutine

### Changes

* Optimize io scheduler for coroutine, cache events for poller
* Add c11 `_Static_assert`
* Remove some deprecated interfaces for hash and platform

## v1.6.0

### New features

* Support make command and compile directly without xmake
* Add switch context interfaces into platform module
* Add coroutine module (supports i386, x86_64, arm, arm64, mips ..)
* Add simple http server demo using coroutine
* Add simple spider using coroutine
* Add io poller interfaces(with epoll, poll, kqueue, select)
* Support mbedtls ssl library
* All io modules(stream, socket, http, ..) support coroutine mode
* Provide lock, semaphone and channel for coroutine

### Changes

* Optimize and rewrite thread local store module
* Modify thread interfaces 
* Mark the asio module as deprecated
* Optimize exception interfaces

### Bugs fixed

* Fix some warning and errors for compiler
* Fix some thread bugs
* Fix parse bplist uid type

## v1.5.3

### New features

* Add wait multi-processes interface
* Add uuid generator
* Add hash library module
* Add `__tb_deprecated__` keyword and option

### Changes

* Move some utils interfaces to the hash module
* Rewrite random generator

### Bugs fixed

* Fix stdout compatibility issue for vs2015
* Fix process arguments length limit

## v1.5.2

### New features

* Add smallest configure option
* Add process operation interfaces

### Changes

* Improve envirnoment interfaces
* Modify xmake.lua for supporting xmake v2.x

### Bugs fixed

* Fix ltimer bug
* Fix asio memory leaks bug
* Fix asio httpd response bug on linux
* Fix path bug for windows

## v1.5.1

### New features

* Add automaticlly check libc interfaces
* Support custom allocator 
* Add trace for allocator in the debug mode
* Add `static_pool` module
* Add stream interfaces for reading all data to string
* Add adler32 hash algorithm
* Add `tb_memmem` interface
* Add regex module with pcre, pcre2 or posix regex 

### Changes

* Optimize stream and support read/write character device file
* Modify `tb_init` api and support allocator arguments
* Improve memory manager and use the allocator mode
* Redefine `assert` and will abort for debug mode 

### Bugs fixed

* Fix some bugs for android
* Fix seek bug for stream

