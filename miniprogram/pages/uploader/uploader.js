Page({
  data: {
    url: 'https://shizheng-kb.onrender.com/mobile-upload'
  },

  onMessage(e) {
    const messages = e.detail && e.detail.messages ? e.detail.messages : []
    const latest = messages[messages.length - 1]
    const data = Array.isArray(latest && latest.data) ? latest.data[latest.data.length - 1] : latest && latest.data
    if (!data || data.type !== 'essay-paper' || !data.paper_id) return
    wx.setStorageSync('PAPER_UPLOAD_RESULT', data)
    wx.navigateBack()
  }
})
