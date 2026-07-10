const api = require('../../utils/api')
Page({
  data: { archives: [], filtered: [], keyword: '', loading: false, loadError: '' },
  onLoad() { this.load() },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()) },
  async load() {
    if (this.data.loading) return
    this.setData({ loading: true, loadError: '' })
    try {
      const archives = await api.listArchives()
      this.setData({ archives: archives || [] })
      this.filter()
    } catch (e) {
      this.setData({ loadError: '时政归档加载失败，请稍后重试', filtered: [] })
    } finally {
      this.setData({ loading: false })
    }
  },
  onSearch(e) { this.setData({ keyword: e.detail.value }); this.filter() },
  filter() {
    const kw = this.data.keyword.trim().toLowerCase()
    if (!kw) return this.setData({ filtered: this.data.archives })
    const filtered = this.data.archives.map(g => {
      const items = (g.items || []).filter(x => (x.title || '').toLowerCase().includes(kw))
      return Object.assign({}, g, { items, count: items.length })
    }).filter(g => g.items.length)
    this.setData({ filtered })
  },
  openArticle(e) {
    const n = e.currentTarget.dataset.news
    wx.navigateTo({ url: `/pages/detail/detail?type=archive&filename=${encodeURIComponent(n.filename)}&title=${encodeURIComponent(n.title)}` })
  }
})