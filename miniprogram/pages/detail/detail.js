const api = require('../../utils/api')
const { safeHtml } = require('../../utils/format')
function stripInlineSourceLink(html) {
  if (!html) return html
  return String(html)
    .replace(/\s*<strong>\u539f\u6587\u94fe\u63a5<\/strong>\s*[\uff1a:]\s*<a\b[^>]*>[\s\S]*?<\/a>/g, '')
    .replace(/\s*\u539f\u6587\u94fe\u63a5\s*[\uff1a:]\s*https?:\/\/[^\s<]+/g, '')
}

Page({
  data: { type: 'archive', filename: '', title: '', html: '', analysisHtml: '', sourceUrl: '', isFav: false, loading: false, loadError: '' },
  onLoad(o) {
    this.setData({ type: o.type || 'archive', filename: decodeURIComponent(o.filename || ''), title: decodeURIComponent(o.title || '') })
    this.load()
  },
  async load() {
    if (this.data.loading) return
    this.setData({ loading: true, loadError: '' })
    try {
      let d
      if (this.data.type === 'archive') {
        const [a, favs] = await Promise.all([api.getArchive(this.data.filename), api.listFavorites()])
        this.setData({ html: safeHtml(stripInlineSourceLink(a.original_html || a.html)), analysisHtml: safeHtml(a.analysis_html || ''), sourceUrl: a.source_url || '', isFav: (favs || []).some(x => x.filename === this.data.filename) })
      } else {
        if (this.data.type === 'report') d = await api.getReport(this.data.filename)
        if (this.data.type === 'topic') d = await api.getTopic(this.data.filename)
        if (this.data.type === 'morning') d = await api.getMorning(this.data.filename)
        this.setData({ html: safeHtml((d && d.html) || '<p>暂无内容</p>') })
      }
    } catch (e) {
      this.setData({ loadError: '内容加载失败，请稍后重试', html: '' })
    } finally {
      this.setData({ loading: false })
    }
  },
  async toggleFavorite() {
    try {
      if (this.data.isFav) { await api.removeFavorite(this.data.filename); this.setData({ isFav: false }); wx.showToast({ title: '已取消', icon: 'none' }) }
      else { await api.addFavorite({ filename: this.data.filename, title: this.data.title }); this.setData({ isFav: true }); wx.showToast({ title: '已收藏' }) }
    } catch (e) { wx.showToast({ title: '操作失败', icon: 'none' }) }
  },
  copySource() {
    if (!this.data.sourceUrl) return
    wx.setClipboardData({ data: this.data.sourceUrl, success() { wx.showToast({ title: '链接已复制', icon: 'success' }) } })
  }
})