const api = require('../../utils/api')
const { optionArray } = require('../../utils/format')
Page({
  data: { pdfs: [], selectedPdf: '', questions: [], practicing: false, practiceQuestions: [], currentIndex: 0, current: {}, currentOptions: [], selected: '', showAnswer: false, correctCount: 0, loading: false, loadingQuestions: false, uploading: false, loadError: '' },
  onShow() { if (!this.data.practicing) this.loadPdfs() },
  async loadPdfs() {
    if (this.data.loading) return
    this.setData({ loading: true, loadError: '' })
    try { this.setData({ pdfs: await api.listPdfs() || [] }) }
    catch (e) { this.setData({ loadError: 'PDF题库加载失败，请稍后重试' }) }
    finally { this.setData({ loading: false }) }
  },
  async selectPdf(e) {
    if (this.data.loadingQuestions) return
    const filename = e.currentTarget.dataset.name
    this.setData({ loadingQuestions: true, selectedPdf: filename, questions: [] })
    try {
      const data = await api.getPdfQuestions(filename)
      this.setData({ questions: (data.questions || []).slice(0, 50) })
      if (!(data.questions || []).length) wx.showToast({ title: '该PDF暂无题目', icon: 'none' })
    } catch (e) { wx.showToast({ title: '题目加载失败', icon: 'none' }) }
    finally { this.setData({ loadingQuestions: false }) }
  },
  choosePdf() {
    if (this.data.uploading) return
    wx.chooseMessageFile({ count: 1, type: 'file', extension: ['pdf'], success: async res => {
      const file = res.tempFiles && res.tempFiles[0]
      if (!file) return
      if (file.size && file.size > 20 * 1024 * 1024) return wx.showToast({ title: 'PDF超过20MB', icon: 'none' })
      this.setData({ uploading: true })
      wx.showLoading({ title: '上传中', mask: true })
      try { await api.uploadPdf(file.path); wx.showToast({ title: '上传成功' }); this.loadPdfs() }
      catch (e) { wx.showToast({ title: '上传失败', icon: 'none' }) }
      finally { wx.hideLoading(); this.setData({ uploading: false }) }
    } })
  },
  startPractice() {
    if (!this.data.questions.length) return wx.showToast({ title: '该 PDF 暂无题目', icon: 'none' })
    this.setData({ practicing: true, practiceQuestions: this.data.questions, currentIndex: 0, correctCount: 0 }, () => this.renderQuestion())
  },
  renderQuestion() { const current = this.data.practiceQuestions[this.data.currentIndex] || {}; this.setData({ current, currentOptions: optionArray(current.options), selected: '', showAnswer: false }) },
  async selectOption(e) {
    if (this.data.showAnswer) return
    const selected = e.currentTarget.dataset.key
    const right = selected === this.data.current.answer
    this.setData({ selected, showAnswer: true, correctCount: this.data.correctCount + (right ? 1 : 0) })
    if (!right) { try { await api.addWrong({ question: this.data.current.question, options: this.data.current.options, answer: this.data.current.answer, user_answer: selected, source: this.data.selectedPdf }) } catch (e) {} }
  },
  async nextQuestion() {
    if (!this.data.showAnswer) return wx.showToast({ title: '请先选择答案', icon: 'none' })
    if (this.data.currentIndex + 1 >= this.data.practiceQuestions.length) {
      try { await api.addQuizHistory({ total: this.data.practiceQuestions.length, correct: this.data.correctCount, source: this.data.selectedPdf }) } catch (e) {}
      wx.showModal({ title: '练习完成', content: `共 ${this.data.practiceQuestions.length} 题，答对 ${this.data.correctCount} 题`, showCancel: false })
      return this.exitPractice()
    }
    this.setData({ currentIndex: this.data.currentIndex + 1 }, () => this.renderQuestion())
  },
  exitPractice() { this.setData({ practicing: false }) }
})