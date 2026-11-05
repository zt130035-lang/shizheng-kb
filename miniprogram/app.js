// 是否运行在微信开发者工具模拟器里(只有模拟器能访问 localhost 调试地址)
function isDevtools() {
  try {
    if (wx.getDeviceInfo) return String((wx.getDeviceInfo() || {}).platform || '') === 'devtools'
    return String((wx.getSystemInfoSync() || {}).platform || '') === 'devtools'
  } catch (e) {
    return false
  }
}

App({
  onLaunch() {
    const defaultUrl = 'https://shizheng-kb.onrender.com'
    const saved = String(wx.getStorageSync('BASE_URL') || '').trim()
    const localHosts = ['127.0.0.1', 'localhost', '0.0.0.0', '10.100.72.76']
    const cachedLocalUrl = localHosts.some(host => saved.includes(host))

    // 模拟器里保留手动设置的本地地址，否则一启动就被覆盖回线上，本地调试永远打到旧后端。
    if (isDevtools()) {
      if (!saved) wx.setStorageSync('BASE_URL', defaultUrl)
      return
    }
    // 真机无法访问本地调试地址，启动时自动恢复线上服务。
    if (!saved || cachedLocalUrl) {
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