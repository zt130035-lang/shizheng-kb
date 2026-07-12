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
  }
})
