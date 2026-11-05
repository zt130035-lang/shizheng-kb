const api = require('../../utils/api')
const { getBaseUrl } = require('../../utils/request')

const ORDERED_TYPES = ['归纳概括', '综合分析', '提出对策', '应用文', '大作文', '其他']

function unique(list) {
  const seen = {}
  const out = []
  ;(list || []).forEach(item => {
    if (!item || seen[item]) return
    seen[item] = true
    out.push(item)
  })
  return out
}

function toNumber(value, fallback) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

// 列表接口只给元信息,逐卷再取详情以支持按题型筛选与题数/分值展示
function buildPaper(summary, detail) {
  const questions = detail && Array.isArray(detail.questions) ? detail.questions : []
  const types = unique(questions.map(item => item && item.type).filter(Boolean))
  const totalScore = questions.reduce((sum, item) => sum + toNumber(item && item.max_score, 0), 0)
  const answered = questions.filter(item => String((item && item.reference_answer) || '').trim()).length
  return {
    id: summary.id,
    year: toNumber(summary.year, 0),
    paper: summary.paper || '行政执法',
    title: summary.title || `${summary.year}年国家公务员考试申论（行政执法类）`,
    questionCount: questions.length,
    totalScore,
    answered,
    types,
    pending: questions.length === 0,
    verified: !!summary.verified,
    statusText: questions.length === 0
      ? '题目待导入'
      : `${answered}/${questions.length} 题已备答案`
  }
}

Page({
  data: {
    papers: [],
    list: [],
    years: [],
    types: [],
    yearChips: [{ value: 0, label: '全部' }],
    typeChips: [{ value: '', label: '全部' }],
    yearFilter: 0,
    typeFilter: '',
    loading: true,
    error: '',
    baseUrl: ''
  },

  onShow() {
    this.loadPapers()
  },

  onPullDownRefresh() {
    this.loadPapers(true)
  },

  async loadPapers(fromPull) {
    if (this._loading) return
    const pull = fromPull === true
    this._loading = true
    if (!pull) this.setData({ loading: true, error: '', baseUrl: getBaseUrl() })
    try {
      const index = await api.listExamPapers()
      if (!index || index.error) throw new Error((index && index.error) || '加载失败')
      const summaries = Array.isArray(index.papers) ? index.papers : []
      const details = await Promise.all(
        summaries.map(item => api.getExamPaper(item.id).catch(() => null))
      )
      const detailById = {}
      details.forEach(item => {
        if (item && item.paper && item.paper.id) detailById[item.paper.id] = item
      })

      const papers = summaries.map(item => buildPaper(item, detailById[item.id]))
      const years = unique(papers.map(item => item.year).filter(Boolean)).sort((a, b) => b - a)
      const allTypes = unique(papers.reduce((acc, item) => acc.concat(item.types), []))
      const orderedTypes = ORDERED_TYPES
        .filter(type => allTypes.indexOf(type) >= 0)
        .concat(allTypes.filter(type => ORDERED_TYPES.indexOf(type) < 0))

      this.setData({
        papers,
        years,
        types: orderedTypes,
        yearChips: [{ value: 0, label: '全部' }].concat(years.map(year => ({ value: year, label: `${year}年` }))),
        typeChips: [{ value: '', label: '全部' }].concat(orderedTypes.map(type => ({ value: type, label: type }))),
        loading: false,
        error: ''
      })
      this.applyFilter()
    } catch (err) {
      this.setData({
        loading: false,
        baseUrl: getBaseUrl(),
        error: String((err && err.message) || err || '加载失败')
      })
    } finally {
      this._loading = false
      if (pull) wx.stopPullDownRefresh()
    }
  },

  applyFilter() {
    const papers = this.data.papers || []
    const yearFilter = Number(this.data.yearFilter) || 0
    const typeFilter = this.data.typeFilter || ''
    const list = papers.filter(item => {
      if (yearFilter && Number(item.year) !== yearFilter) return false
      if (typeFilter && item.types.indexOf(typeFilter) < 0) return false
      return true
    })
    this.setData({ list })
  },

  selectYear(e) {
    const value = Number(e.currentTarget.dataset.value) || 0
    if (value === this.data.yearFilter) return
    this.setData({ yearFilter: value }, () => this.applyFilter())
  },

  selectType(e) {
    const value = e.currentTarget.dataset.value || ''
    if (value === this.data.typeFilter) return
    this.setData({ typeFilter: value }, () => this.applyFilter())
  },

  openPaper(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/exam-detail/exam-detail?paper=${encodeURIComponent(id)}` })
  }
})