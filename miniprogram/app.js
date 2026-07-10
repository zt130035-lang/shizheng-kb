App({
  onLaunch() {
    const defaultUrl = 'https://shizheng-kb.onrender.com'
    const saved = String(wx.getStorageSync('BASE_URL') || '')
    // 正式版默认使用线上 HTTPS；如果之前缓存的是本地调试地址，则自动切到线上。
    if (!saved || saved.includes('127.0.0.1') || saved.includes('localhost') || saved.includes('10.100.72.76')) {
      wx.setStorageSync('BASE_URL', defaultUrl)
    }
  },
  onError(err) {
    const msg = String(err || '').toLowerCase()
    if (msg.includes('timeout')) {
      console.warn('[app timeout ignored]', err)
      return
    }
    console.error(err)
  },
  onUnhandledRejection(res) {
    const reason = res && res.reason ? String(res.reason) : String(res || '')
    if (reason.toLowerCase().includes('timeout')) {
      console.warn('[promise timeout ignored]', reason)
      return
    }
    console.error('[unhandled rejection]', res)
  }
})