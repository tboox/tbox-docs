## 文件系统

### 打开文件

通过合法路径打开普通文件：

```c
const char* path = "/path/to/file"
tb_size_t mode = TB_FILE_MODE_RW; //see below;
tb_file_ref_t fout= tb_file_init (path, mode);
if (fout != tb_null){
    // operate on fout
    if(!tb_file_close(fout)){
        // handle failure during closing file
    };
} else {
    // handle failure during opening file
}
```
路径以UTF-8编码，调用者必须关闭由`tb_file_init`打开的文件。

### 文件模式

可以在下表所列的模式或者模式组合下打开文件：

<table>
    <tr>
        <th> 模式 </th>
        <th> 功能 </th>
        <th> 组合性 </th>
        <th> <code>tb_file_access</code> 能否检测 </th>
    </tr>
    <tr>
        <td> <code>TB_FILE_MODE_RO</code> </td>
        <td> 只读，只能从文件读出内容 </td>
        <td rowspan=3> 只能使用三种模式之一，若不指定则为只读模式 </td>
        <td rowspan=4> 可以检测 </td>
    </tr>
    <tr>
        <td> <code>TB_FILE_MODE_WO</code> </td>
        <td> 只写，只能向文件写入内容 </td>
    </tr>
    <tr>
        <td> <code>TB_FILE_MODE_RW</code> </td>
        <td> 读写，可以从文件读出或向文件写入内容 </td>
    </tr>
    <tr>
        <td> <code>TB_FILE_MODE_DIRECT</code> </td>
        <td> 不使用操作系统的文件缓存 </td>
        <td> 只在 <code>tb_file_init</code> 函数中使用 </td>
    </tr>
    <tr>
        <td> <code>TB_FILE_MODE_CREAT</code> </td>
        <td> 如果文件不存在就创建文件 </td>
        <td>  </td>
        <td rowspan = 4> 只能在Posix系统上检测 </td>
    </tr>
    <tr>
        <td> <code>TB_FILE_MODE_TRUNC</code> </td>
        <td> 将文件的长度截短至0，丢弃文件原有的内容 </td>
        <td>  </td>
    </tr>
    <tr>
        <td> <code>TB_FILE_MODE_APPEND</code> </td>
        <td> 在文件的末尾追加内容 </td>
        <td>  </td>
    </tr>
    <tr>
        <td> <code>TB_FILE_MODE_EXEC</code> </td>
        <td> 检测文件是否具有可执行权限 </td>
        <td> 只在 <code>tb_file_access</code> 函数中使用 </td>
    </tr>
</table>

检测能否以读写方式打开文件:
```c
const char* path = "/path/to/file"
tb_size_t mode = TB_FILE_MODE_RW;
if(tb_file_access (path, mode)){
    // read and write given file
}else{
    // handle error
};
```

### 文件读写

Editing

### 不需要打开文件的操作

Editing

## Editing
