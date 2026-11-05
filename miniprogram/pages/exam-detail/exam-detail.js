const api = require('../../utils/api')

const MODE_LABELS = {
  imitate: '仿写示范',
  outline: '结构拆解',
  phrases: '可套用句式'
}

function answerLabel(kind) {
  if (kind === 'official') return '官方答案'
  if (kind === 'imported') return '导入答案 · 非官方'
  if (kind === 'ai') return 'AI 参照答案 · 非官方'
  return '暂无参考答案'
}

function textToHtml(text) {
  const escaped = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
  return escaped
}

function buildSourceText(paper) {
  const source = paper.source || '未标注来源'
  if (paper.verified) return `来源：${source}`
  return `题干待核对 · 来源：${source}`
}

function normalizeQuestion(question, index) {
  const item = question && typeof question === 'object' ? question : {}
  const id = String(item.id || index + 1)
  const score = Number(item.max_score)
  return {
    id,
    no: item.no || id,
    type: item.type || '其他',
    task: String(item.task || ''),
    material_ref: String(item.material_ref || ''),
    scoreText: Number.isFinite(score) && score > 0 ? `${score} 分` : '',
    reference_answer: String(item.reference_answer || ''),
    answer_kind: String(item.answer_kind || ''),
    answer_source: String(item.answer_source || ''),
    answerLabel: answerLabel(item.answer_kind),
    score_points: Array.isArray(item.score_points) ? item.score_points.filter(Boolean) : [],
    structure: Array.isArray(item.structure) ? item.structure.filter(Boolean) : [],
    imitate_tips: String(item.imitate_tips || '')
  }
}

Page({
  data: {
    paperId: '',
    paper: null,
    questions: [],
    current: null,
    currentIndex: 0,
    answeredCount: 0,
    materialOpen: false,
    loading: true,
    error: '',
    generating: false,
    jobRunning: false,
    jobText: '',
    aiBusy: false,
    aiModeLabel: '',
    aiHtml: '',
    aiText: '',
    aiError: ''
  },

  onLoad(query) {
    const paperId = decodeURIComponent((query && query.paper) || '')
    if (!paperId) {
      this.setData({ loading: false, error: '缺少试卷参数' })
      return
    }
    this.setData({ paperId })
    this.loadPaper(query && query.q)
  },

  onShow() {
    if (this.data.paperId && this.data.paper) this.checkJob()
  },

  onHide() {
    this.stopPolling()
  },

  onUnload() {
    this.stopPolling()
  },

  stopPolling() {
    if (this._jobTimer) {
      clearInterval(this._jobTimer)
      this._jobTimer = null
    }
  },

  startPolling() {
    this.stopPolling()
    this._jobTimer = setInterval(() => this.checkJob(), 3000)
  },

  async checkJob() {
    if (!this.data.paperId) return
    const body = await api.getExamGenerateStatus(this.data.paperId).catch(() => null)
    if (body && body.job) this.applyJob(body.job)
  },

  applyJob(job) {
    const running = job.status === 'running'
    const total = Number(job.total) || 0
    const done = Number(job.done) || 0
    if (!running) {
      this.stopPolling()
      this.setData({ jobRunning: false, jobText: '' })
      const stamp = String(job.updated_at || job.status || '')
      const updatedTs = Number(job.updated_ts) || 0
      // 只对 10 分钟内结束的任务提示并刷新，避免每次进页面都弹旧任务
      const fresh = !updatedTs || (Date.now() / 1000 - updatedTs) < 600
      if (fresh && stamp && stamp !== this._lastJobStamp) {
        this._lastJobStamp = stamp
        if (job.status === 'done' && done > 0) {
          wx.showToast({ title: `已生成 ${done} 题答案`, icon: 'success' })
          this.reloadAfterJob()
        } else if (job.status === 'failed') {
          wx.showToast({ title: String(job.message || '部分题目生成失败').slice(0, 28), icon: 'none' })
          this.reloadAfterJob()
        }
      }
      return
    }
    this.setData({
      jobRunning: true,
      jobText: total ? `生成中 ${done}/${total}` : '生成中…'
    })
    if (!this._jobTimer) this.startPolling()
  },

  reloadAfterJob() {
    const current = this.data.current
    this.loadPaper(current && current.id)
  },

  async generateWholePaper() {
    if (this.data.jobRunning || this._submitting) return
    const questions = this.data.questions || []
    if (!questions.length) return
    const force = this.data.answeredCount >= questions.length
    this._submitting = true
    wx.showLoading({ title: '提交生成任务', mask: true })
    try {
      const body = await api.generateExamPaperAnswers(this.data.paperId, force)
      if (!body || body.error) {
        wx.showToast({ title: String((body && body.error) || '提交失败').slice(0, 28), icon: 'none' })
        return
      }
      this._lastJobStamp = ''
      if (!body.started) {
        this.applyJob(body.job || {})
        if (body.message) wx.showToast({ title: String(body.message).slice(0, 28), icon: 'none' })
        return
      }
      this.applyJob(body.job || { status: 'running', total: questions.length, done: 0 })
      wx.showToast({ title: '已开始生成', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: String((err && err.message) || err || '提交失败').slice(0, 28), icon: 'none' })
    } finally {
      wx.hideLoading()
      this._submitting = false
    }
  },

  async loadPaper(preferQid) {
    if (this._loading) return
    // bindtap 重试时第一个参数是事件对象，这里只接受题目 id 字符串
    const qid = typeof preferQid === 'string' ? preferQid : ''
    this._loading = true
    this.setData({ loading: true, error: '' })
    try {
      const body = await api.getExamPaper(this.data.paperId)
      if (!body || body.error) throw new Error((body && body.error) || '加载失败')
      const rawPaper = body.paper || {}
      const paper = {
        ...rawPaper,
        id: rawPaper.id || this.data.paperId,
        title: rawPaper.title || `${rawPaper.year || ''}年国考申论（行政执法类）`,
        paper: rawPaper.paper || '行政执法',
        sourceText: buildSourceText(rawPaper),
        materials: String(rawPaper.materials || '')
      }
      const questions = (Array.isArray(body.questions) ? body.questions : [])
        .map(normalizeQuestion)
      const index = qid
        ? Math.max(0, questions.findIndex(item => item.id === qid))
        : 0
      this.setData({
        paper,
        questions,
        answeredCount: questions.filter(item => item.reference_answer).length,
        loading: false,
        error: ''
      })
      this.setCurrent(index)
      const title = `${paper.year || ''} 国考真题`
      if (paper.year) wx.setNavigationBarTitle({ title })
      this.checkJob()
    } catch (err) {
      this.setData({ loading: false, error: String((err && err.message) || err || '加载失败') })
    } finally {
      this._loading = false
    }
  },

  setCurrent(index) {
    const questions = this.data.questions || []
    if (!questions.length) {
      this.setData({ current: null, currentIndex: 0 })
      return
    }
    const safeIndex = Math.min(Math.max(0, Number(index) || 0), questions.length - 1)
    this.setData({
      currentIndex: safeIndex,
      current: questions[safeIndex],
      materialOpen: false,
      aiHtml: '',
      aiText: '',
      aiError: '',
      aiModeLabel: ''
    })
  },

  selectQuestion(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isInteger(index) || index === this.data.currentIndex) return
    this.setCurrent(index)
  },

  toggleMaterial() {
    this.setData({ materialOpen: !this.data.materialOpen })
  },

  copyAnswer() {
    const answer = this.data.current && this.data.current.reference_answer
    if (!answer) return
    wx.setClipboardData({
      data: answer,
      success() { wx.showToast({ title: '参考作答已复制', icon: 'success' }) }
    })
  },

  async generateAnswer() {
    const current = this.data.current
    if (!current || this.data.generating) return
    this.setData({ generating: true })
    wx.showLoading({ title: '生成参照答案', mask: true })
    try {
      // 导入/官方答案不覆盖，只有 AI 答案才允许强制重生成
      const force = current.answer_kind !== 'imported' && current.answer_kind !== 'official'
      const body = await api.generateExamAnswer(this.data.paperId, current.id, force)
      if (!body || body.error) {
        wx.showToast({ title: String((body && body.error) || '生成失败').slice(0, 28), icon: 'none' })
        return
      }
      const question = normalizeQuestion(body.question || current, this.data.currentIndex)
      const questions = this.data.questions.slice()
      questions[this.data.currentIndex] = question
      this.setData({
        questions,
        answeredCount: questions.filter(item => item.reference_answer).length
      })
      this.setCurrent(this.data.currentIndex)
      wx.showToast({ title: body.cached ? '已读取缓存答案' : '已生成参照答案', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: String((err && err.message) || err || '生成失败').slice(0, 28), icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ generating: false })
    }
  },

  async runImitate(e) {
    const mode = e.currentTarget.dataset.mode || 'imitate'
    const current = this.data.current
    if (!current) return
    if (this.data.aiBusy) return
    if (!current.reference_answer) {
      return wx.showToast({ title: '请先生成或导入参考答案', icon: 'none' })
    }
    this.setData({
      aiBusy: true,
      aiModeLabel: MODE_LABELS[mode] || '仿写示范',
      aiHtml: '',
      aiText: '',
      aiError: ''
    })
    try {
      const body = await api.imitateExam({
        paper_id: this.data.paperId,
        qid: current.id,
        mode
      })
      if (!body || body.error) {
        this.setData({ aiError: String((body && body.error) || '生成失败，请稍后重试') })
        return
      }
      const text = String(body.answer || '')
      this.setData({
        aiText: text,
        aiHtml: body.html || textToHtml(text)
      })
      wx.pageScrollTo({ scrollTop: 99999, duration: 260 })
    } catch (err) {
      this.setData({ aiError: String((err && err.message) || err || '生成失败，请稍后重试') })
    } finally {
      this.setData({ aiBusy: false })
    }
  },

  copyAiResult() {
    if (!this.data.aiText) return
    wx.setClipboardData({
      data: this.data.aiText,
      success() { wx.showToast({ title: '已复制', icon: 'success' }) }
    })
  }
})