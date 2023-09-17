## 文件系统

### 打开文件

通过合法路径打开普通文件：

```c
const char* path = "/path/to/file";
tb_size_t mode = TB_FILE_MODE_RW; //see below;
tb_file_ref_t file = tb_file_init(path, mode);
if (file)
{
    // operate on fout
    tb_file_close(fout)
}
```
路径以UTF-8编码，调用者必须关闭由`tb_file_init`打开的文件。

### 文件模式

可以在下表所列的模式或者模式组合下打开文件：

* `TB_FILE_MODE_RO`: 只读，只能从文件读出内容
* `TB_FILE_MODE_WO`: 只写，只能向文件写入内容
* `TB_FILE_MODE_RW`: 读写，可以从文件读出或向文件写入内容
* `TB_FILE_MODE_DIRECT`: 不使用操作系统的文件缓存，只在`tb_file_init`函数中作为选项使用
* `TB_FILE_MODE_CREAT`: 如果文件不存在就创建文件
* `TB_FILE_MODE_TRUNC`: 将文件的长度截短至0，丢弃文件原有的内容
* `TB_FILE_MODE_APPEND`: 在文件的末尾追加内容
* `TB_FILE_MODE_EXEC`: 检测文件是否具有可执行权限，只在`tb_file_access`函数中作为选项使用

!> `TB_FILE_MODE_RO`、`TB_FILE_MODE_RO`、`TB_FILE_MODE_RO`三种模式之间只能选择其一，如果三者中未指定任何一个模式，则默认为只读模式。

!> Windows平台下无法通过`tb_file_access`检测`TB_FILE_MODE_CREAT`、`TB_FILE_MODE_TRUNC`、`TB_FILE_MODE_APPEND`、`TB_FILE_MODE_EXEC`这四个选项。

检测能否以读写方式打开文件:
```c
const char* path = "/path/to/file";
tb_size_t mode = TB_FILE_MODE_RW;
if (tb_file_access(path, mode))
{
    // read and write given file
}
else
{
    // handle error
};
```

### 文件读写

Editing

### 不需要打开文件的操作

Editing

## Editing
