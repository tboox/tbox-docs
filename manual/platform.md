## File

### Open file

Given a vaild path, opening a regular file:

```c
tb_size_t mode = TB_FILE_MODE_RW; //see below;
tb_file_ref_t file = tb_file_init("/path/to/file", mode);
if (file)
{
    // operate on file
    tb_file_close(file)
}
```

Path is encoded by utf-8. All file opened by `tb_file_init` must be closed by caller.

### File mode

File can be opened with modes shown below, or arbitary combination with them:

* `TB_FILE_MODE_RO`: Only read from file is allowed
* `TB_FILE_MODE_WO`: Only write to file is allowed
* `TB_FILE_MODE_RW`: Both read and write is allowed
* `TB_FILE_MODE_DIRECT`: Open file with no system cache or buffer, used in `tb_file_init` only
* `TB_FILE_MODE_CREAT`: Creat file if file is not exist
* `TB_FILE_MODE_TRUNC`: Truncate given file to size 0, thus drops previous content
* `TB_FILE_MODE_APPEND`: Append to the end of existing file
* `TB_FILE_MODE_EXEC`: Tells whether given file is execuable, used in `tb_file_access` only

!> Only one of `TB_FILE_MODE_RO`, `TB_FILE_MODE_RO` and `TB_FILE_MODE_RO` modes should be selected, if no mode is selected then readonly mode is used.

!> `TB_FILE_MODE_CREAT`, `TB_FILE_MODE_TRUNC`, `TB_FILE_MODE_APPEND`, `TB_FILE_MODE_EXEC` cannot be detected by `tb_file_access` on windows.

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
