function integrateGitalk(router) {
  const linkGitalk = document.createElement('link')
  linkGitalk.href = '/assets/css/gitalk.css'
  linkGitalk.rel = 'stylesheet'
  document.body.appendChild(linkGitalk)
  const scriptGitalk = document.createElement('script')
  scriptGitalk.src = '/assets/js/gitalk.min.js'
  document.body.appendChild(scriptGitalk)

  router.afterEach((to) => {
    if (scriptGitalk.onload) {
      loadGitalk(to)
    } else {
      scriptGitalk.onload = () => {
        loadGitalk(to)
      }
    }
  })

  function loadGitalk(to) {
    const commentsContainer = document.createElement('div')
    commentsContainer.id = 'gitalk-container'
    commentsContainer.classList.add('content')
    const $page = document.querySelector('.page')
    if ($page) {
      $page.appendChild(commentsContainer)
      renderGitalk(to.fullPath)
    }
  }
  function renderGitalk(fullPath) {
    const gitalk = new Gitalk({
      clientID: '3ebed7fd0834268f0add',
      clientSecret: 'b68e2ebf0bd9358eccaf3159f3a4cebb66e3b398',
      repo: 'tbox-docs',
      owner: 'waruqi',
      admin: ['waruqi'],
      id: 'comment',
      distractionFreeMode: false  
    })
    gitalk.render('gitalk-container')
  }
}

export default ({Vue, options, router, siteData}) => {
  try {
    document && integrateGitalk(router)
  } catch (e) {
    console.error(e.message)
  }
}
