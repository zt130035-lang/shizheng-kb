Page({
  data: {
    steps: [
      { title: '上传图片', desc: '拍照或从相册选择清晰作文图片。' },
      { title: '识别批改', desc: '系统识别作文内容并生成修改建议。' },
      { title: '保存参考', desc: '批改完成后可复制结果，也会保留最近记录。' }
    ]
  },

  goReview() {
    wx.switchTab({ url: '/pages/query/query' })
  },

  goTemplates() {
    wx.switchTab({ url: '/pages/templates/templates' })
  }
})