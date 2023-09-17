## File

### Open file

Given a vaild path, opening a regular file:

```c
const char* path = "/path/to/file";
tb_size_t mode = TB_FILE_MODE_RW; //see below;
tb_file_ref_t fout = tb_file_init(path, mode);
if (fout != tb_null)
{
    // operate on fout
    if (!tb_file_close(fout))
    {
        // handle failure during closing file
    };
}
else
{
    // handle failure during opening file
}
```

Path is encoded by utf-8. All file opened by `tb_file_init` must be closed by caller.

### File mode

File can be opened with modes shown shown below, or arbitary combination with them:

<table>
    <tr>
        <th> Mode </th>
        <th> Function </th>
        <th> Combination </th>
        <th> Detected by <code>tb_file_access</code>
    </tr>
    <tr>
        <td> <code>TB_FILE_MODE_RO</code> </td>
        <td> Only read from file is allowed </td>
        <td rowspan=3> Only one of the three modes should be used </td>
        <td rowspan=4> yes </td>
    </tr>
    <tr>
        <td> <code>TB_FILE_MODE_WO</code> </td>
        <td> Only write to file is allowed </td>
    </tr>
    <tr>
        <td> <code>TB_FILE_MODE_RW</code> </td>
        <td> Both read and write is allowed </td>
    </tr>
    <tr>
        <td> <code>TB_FILE_MODE_DIRECT</code> </td>
        <td> Open file with no system cache or buffer </td>
        <td> Used in <code>tb_file_init</code> only </td>
    </tr>
    <tr>
        <td> <code>TB_FILE_MODE_CREAT</code> </td>
        <td> Creat file if file is not exist </td>
        <td>  </td>
        <td rowspan = 4> Only on posix </td>
    </tr>
    <tr>
        <td> <code>TB_FILE_MODE_TRUNC</code> </td>
        <td> Truncate given file to size 0 </td>
        <td>  </td>
    </tr>
    <tr>
        <td> <code>TB_FILE_MODE_APPEND</code> </td>
        <td> Append to the end of existing file </td>
        <td>  </td>
    </tr>
    <tr>
        <td> <code>TB_FILE_MODE_EXEC</code> </td>
        <td> Tells whether given file is execuable </td>
        <td> Used in <code>tb_file_access</code> only </td>
    </tr>
</table>

Detect whether a file can be read and write:
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

### File read and write

Editing

### Operations that does not open file

Editing

## Editing
