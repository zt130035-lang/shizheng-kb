Page({
  data: {
    steps: [
      { title: '选材料', desc: '上传真题或作文图。' },
      { title: '交答案', desc: '粘贴或上传答案。' },
      { title: '看结果', desc: '查看评分和修改建议。' }
    ]
  },

  goReview() {
    wx.switchTab({ url: '/pages/query/query' })
  },

  goTemplates() {
    wx.switchTab({ url: '/pages/templates/templates' })
  },

  goFeature(e) {
    const target = e.currentTarget.dataset.target
    if (target === 'structure') {
      return wx.showToast({ title: '结构优化即将上线', icon: 'none' })
    }
    const pages = {
      review: '/pages/query/query',
      templates: '/pages/templates/templates',
      mine: '/pages/mine/mine'
    }
    if (pages[target]) wx.switchTab({ url: pages[target] })
  }
})
