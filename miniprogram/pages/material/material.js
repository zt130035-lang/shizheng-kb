const api = require('../../utils/api')
Page({
  data: { kind: 'reports', items: [], loading: false, loadError: '' },
  onLoad(o) { this.setData({ kind: o.kind || 'reports' }); this.load() },
  switchKind(e) {
    const kind = e.currentTarget.dataset.kind
    if (kind === this.data.kind || this.data.loading) return
    this.setData({ kind, items: [], loadError: '' })
    this.load()
  },
  async load() {
    if (this.data.loading) return
    this.setData({ loading: true, loadError: '' })
    try {
      let rows = []
      if (this.data.kind === 'reports') rows = await api.listReports()
      if (this.data.kind === 'topics') rows = await api.listTopics()
      if (this.data.kind === 'morning') rows = await api.listMorning()
      rows = (rows || []).map(x => Object.assign({}, x, { title: this.titleOf(x) }))
      this.setData({ items: rows })
    } catch (e) {
      this.setData({ loadError: '学习材料加载失败，请稍后重试', items: [] })
    } finally {
      this.setData({ loading: false })
    }
  },
  titleOf(x) {
    if (this.data.kind === 'reports') return `${x.date} ${x.type || '日报'}`
    if (this.data.kind === 'topics') return `${x.date} 时政专题素材包`
    return `${x.date} 时政晨读卡`
  },
  openDetail(e) {
    const item = e.currentTarget.dataset.item
    const type = this.data.kind === 'reports' ? 'report' : (this.data.kind === 'topics' ? 'topic' : 'morning')
    wx.navigateTo({ url: `/pages/detail/detail?type=${type}&filename=${encodeURIComponent(item.filename)}&title=${encodeURIComponent(item.title)}` })
  }
})