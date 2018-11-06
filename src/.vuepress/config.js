module.exports = {
  dest: 'docs',
  head: [
    ['link', { rel: 'shortcut icon', type: "image/x-icon", href: `/favicon.ico` }]
  ],
  locales: {
    '/': {
      lang: 'en-US',
      title: 'TBOX',
      description: 'A glib-like cross-platform C library'
    },
    '/zh/': {
      lang: 'zh-CN',
      title: 'TBOX',
      description: '一个用c语言实现的跨平台开发库'
    }
  },
  themeConfig: {
    repo: 'tboox/tbox',
    docsRepo: 'tboox/tbox-docs',
    docsDir: 'src',
    editLinks: true,
    sidebarDepth: 2,
    locales: {
      '/': {
        label: 'English',
        selectText: 'Languages',
        editLinkText: 'Edit this page on GitHub',
        lastUpdated: 'Last Updated',
        nav: [
          {
            text: 'Guide',
            link: '/guide/introduction'
          },
          {
            text: 'Manual',
            link: '/manual/introduction'
          },
          {
            text: 'Articles',
            link: 'http://www.tboox.org/category/#tbox'
          },
          {
            text: 'Feedback',
            link: 'https://github.com/tboox/xmake/issues'
          },
          {
            text: 'Community',
            link: 'https://www.reddit.com/r/tboox/'
          },
          {
            text: 'Donation',
            link: 'http://tboox.org/cn/donation/'
          }
        ],
        sidebar: [
          {
            title: 'Guide',
            children: [
              '/guide/introduction',
              '/guide/getting-started',
            ]
          },
          {
            title: 'Manual',
            children: [
              '/manual/introduction'
            ]
          }
        ]
      },
      '/zh/': {
        label: '简体中文',
        selectText: '选择语言',
        editLinkText: '在 GitHub 上编辑此页',
        lastUpdated: '上次更新',
        nav: [
          {
            text: '指南',
            link: '/zh/guide/introduction'
          },
          {
            text: '手册',
            link: '/zh/manual/introduction'
          },
          {
            text: '文章',
            link: 'http://www.tboox.org/cn/category/#tbox'
          },
          {
            text: '反馈',
            link: 'https://github.com/tboox/xmake/issues'
          },
          {
            text: '社区',
            link: 'https://www.reddit.com/r/tboox/'
          },
          {
            text: '捐助',
            link: 'http://tboox.org/cn/donation/'
          }
        ],
        sidebar: [
          {
            title: '指南',
            children: [
              '/zh/guide/introduction',
              '/zh/guide/getting-started',
            ]
          },
          {
            title: '手册',
            children: [
              '/zh/manual/introduction'
            ]
          }
        ]
      }
    }
  }
}
