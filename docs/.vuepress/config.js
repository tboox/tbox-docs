module.exports = {
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
    docsDir: 'docs',
    editLinks: true,
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
            link: '/manual/index'
          }
        ],
        sidebar: [
          {
            title: 'Guide',
            children: [
              '/guide/introduction',
              '/guide/getting-started',
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
            link: '/zh/manual/index'
          }
        ],
        sidebar: [
          {
            title: '指南',
            children: [
              '/zh/guide/introduction',
              '/zh/guide/getting-started',
            ]
          }
        ]
      }
    }
  }
}
