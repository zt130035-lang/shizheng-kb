App({
  onLaunch() {
    // 仅首次启动写入默认线上地址;用户手动设置的 BASE_URL(本地调试等)不再被覆盖
    if (!wx.getStorageSync('BASE_URL')) {
      wx.setStorageSync('BASE_URL', 'https://shizheng-kb.onrender.com')
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