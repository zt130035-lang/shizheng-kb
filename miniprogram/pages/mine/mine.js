const RECORD_KEY = 'ESSAY_REVIEW_RECORDS'

Page({
  data: {
    records: [],
    tips: [
      '图片只用于本次批改。',
      '结果仅供练习参考。',
      '请勿上传身份证号、手机号等隐私信息。'
    ]
  },

  onShow() {
    this.loadRecords()
  },

  loadRecords() {
    const records = wx.getStorageSync(RECORD_KEY) || []
    this.setData({ records: Array.isArray(records) ? records : [] })
  },

  copyRecord(e) {
    const id = Number(e.currentTarget.dataset.id)
    const record = this.data.records.find(item => Number(item.id) === id)
    if (!record || !record.answer) return
    wx.setClipboardData({
      data: record.answer,
      success() { wx.showToast({ title: '已复制', icon: 'success' }) }
    })
  },

  clearRecords() {
    wx.showModal({
      title: '清空记录',
      content: '确认清空本机保存的批改记录吗？',
      success: (res) => {
        if (!res.confirm) return
        wx.removeStorageSync(RECORD_KEY)
        this.setData({ records: [] })
        wx.showToast({ title: '已清空', icon: 'success' })
      }
    })
  }
})
