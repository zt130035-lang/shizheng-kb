const { getBaseUrl } = require('../../utils/request')
Page({
  data: { baseUrl: '', checking: false, statusText: '' },
  onLoad() { this.setData({ baseUrl: getBaseUrl() }) },
  onInput(e) { this.setData({ baseUrl: e.detail.value }) },
  save() {
    const url = this.data.baseUrl.trim().replace(/\/+$/, '')
    if (!/^https?:\/\//.test(url)) return wx.showToast({ title: '请输入完整地址', icon: 'none' })
    wx.setStorageSync('BASE_URL', url)
    this.setData({ baseUrl: url })
    wx.showToast({ title: '已保存' })
  },
  checkService() {
    if (this.data.checking) return
    const base = this.data.baseUrl.trim().replace(/\/+$/, '')
    if (!/^https?:\/\//.test(base)) return wx.showToast({ title: '请先填写完整地址', icon: 'none' })
    this.setData({ checking: true, statusText: '检测中...' })
    wx.request({
      url: base + '/api/stats',
      method: 'GET',
      timeout: 20000,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) this.setData({ statusText: '后端连接正常' })
        else this.setData({ statusText: '后端异常：HTTP ' + res.statusCode })
      },
      fail: (err) => this.setData({ statusText: '连接失败：' + ((err && err.errMsg) || '网络异常') }),
      complete: () => this.setData({ checking: false })
    })
  }
})