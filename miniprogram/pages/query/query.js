const api = require('../../utils/api')

const RECORD_KEY = 'ESSAY_REVIEW_RECORDS'

function safeHtml(html) {
  if (!html) return '<p>暂无内容</p>'
  return String(html).replace(/target="_blank"/g, '')
}

function userMessage(err) {
  const msg = String(err || '')
  if (msg.includes('额度') || msg.includes('insufficient') || msg.includes('余额')) return 'AI额度不足，请稍后再试'
  if (msg.includes('401')) return 'AI服务认证失败'
  if (msg.includes('403')) return 'AI模型暂无权限'
  if (msg.includes('413') || msg.includes('过大')) return '文件过大，请控制在25MB以内'
  if (msg.includes('timeout') || msg.includes('超时')) return '处理耗时较长，请稍后重试'
  return msg || '处理失败，请稍后重试'
}

function formatTime(date) {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function saveRecord(topic, answer) {
  const records = wx.getStorageSync(RECORD_KEY) || []
  const text = String(answer || '')
  const next = [{
    id: Date.now(),
    topic: topic || '未填写题目',
    time: formatTime(new Date()),
    summary: text.replace(/<[^>]+>/g, '').slice(0, 80),
    answer: text
  }].concat(Array.isArray(records) ? records : []).slice(0, 20)
  wx.setStorageSync(RECORD_KEY, next)
}

Page({
  data: {
    reviewKind: 'full',
    paperTitle: '',
    paperText: '',
    paperFilePath: '',
    paperFileName: '',
    answerText: '',
    answerImages: [],
    fullReview: null,
    essayTopic: '',
    essayImage: '',
    essayAnswer: '',
    essayAnswerHtml: '',
    reviewing: false,
    reviewMode: 'fast'
  },

  setReviewKind(e) {
    if (this.data.reviewing) return
    const kind = e.currentTarget.dataset.kind === 'image' ? 'image' : 'full'
    this.setData({ reviewKind: kind })
  },

  onPaperTitleInput(e) { this.setData({ paperTitle: e.detail.value }) },
  onPaperTextInput(e) { this.setData({ paperText: e.detail.value }) },
  onAnswerInput(e) { this.setData({ answerText: e.detail.value }) },
  onTopicInput(e) { this.setData({ essayTopic: e.detail.value }) },

  chooseAnswerImages() {
    if (this.data.reviewing) return
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['album'],
      sizeType: ['compressed'],
      success: (res) => {
        const files = (res.tempFiles || []).slice(0, 9)
        if (!files.length) return
        if (files.some(file => file.size && file.size > 7 * 1024 * 1024)) {
          return wx.showToast({ title: '单张答案图片不能超过7MB', icon: 'none' })
        }
        this.setData({
          answerImages: files.map(file => ({
            path: file.tempFilePath,
            name: file.name || '答案图片',
            size: file.size || 0
          }))
        })
      }
    })
  },

  removeAnswerImage(e) {
    const index = Number(e.currentTarget.dataset.index)
    const answerImages = this.data.answerImages.slice()
    if (Number.isInteger(index) && index >= 0) answerImages.splice(index, 1)
    this.setData({ answerImages })
  },

  choosePaperFile() {
    if (this.data.reviewing) return
    if (!wx.chooseMessageFile) {
      return wx.showToast({ title: '当前微信版本不支持文件选择', icon: 'none' })
    }
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf', 'docx', 'txt', 'md'],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file || !file.path) return
        if (file.size && file.size > 25 * 1024 * 1024) {
          return wx.showToast({ title: '文件超过25MB', icon: 'none' })
        }
        this.setData({
          paperFilePath: file.path,
          paperFileName: file.name || '已选择整套试卷',
          fullReview: null
        })
      },
      fail: (err) => {
        if (!String(err && err.errMsg || '').includes('cancel')) {
          wx.showToast({ title: '未能选择文件', icon: 'none' })
        }
      }
    })
  },

  async submitFullReview() {
    if (this.data.reviewing) return
    if (!this.data.paperFilePath && this.data.paperText.trim().length < 20) {
      return wx.showToast({ title: '请上传或粘贴材料与题目', icon: 'none' })
    }
    if (this.data.answerText.trim().length < 2 && !this.data.answerImages.length) {
      return wx.showToast({ title: '请填写文字答案或上传答案图片', icon: 'none' })
    }

    this.setData({ reviewing: true, fullReview: null, essayAnswer: '', essayAnswerHtml: '' })
    wx.showLoading({ title: this.data.answerImages.length ? '识别答案图片' : '整套批改中', mask: true })
    try {
      let imageAnswer = ''
      if (this.data.answerImages.length) {
        const ocrParts = []
        for (let index = 0; index < this.data.answerImages.length; index += 1) {
          const item = this.data.answerImages[index]
          const ocr = await api.ocrEssayImage(item.path, { page: String(index + 1) })
          if (ocr.error) throw new Error(`第${index + 1}张答案图片：${userMessage(ocr.error)}`)
          if (ocr.text) ocrParts.push(`第${index + 1}页答案：\n${ocr.text}`)
        }
        imageAnswer = ocrParts.join('\n\n')
        if (!imageAnswer.trim()) throw new Error('答案图片未识别出文字，请换清晰图片重试')
        wx.showLoading({ title: '整套批改中', mask: true })
      }
      const payload = {
        topic: this.data.paperTitle.trim(),
        paper_text: this.data.paperText.trim(),
        answers: [this.data.answerText.trim(), imageAnswer].filter(Boolean).join('\n\n')
      }
      const result = this.data.paperFilePath
        ? await api.reviewEssaySet(this.data.paperFilePath, payload)
        : await api.reviewEssaySetText(payload)
      if (result.error) {
        wx.showToast({ title: userMessage(result.error).slice(0, 28), icon: 'none' })
        return
      }
      const answer = result.answer || ''
      this.setData({
        fullReview: result.report || null,
        essayAnswer: answer,
        essayAnswerHtml: safeHtml(result.html || answer)
      })
      if (answer) saveRecord(this.data.paperTitle || '申论整套批改', answer)
    } catch (err) {
      wx.showToast({ title: userMessage(err).slice(0, 28), icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ reviewing: false })
    }
  },

  setReviewMode(e) {
    if (this.data.reviewing) return
    const mode = e.currentTarget.dataset.mode === 'deep' ? 'deep' : 'fast'
    this.setData({ reviewMode: mode })
  },

  chooseEssayImage(e) {
    if (this.data.reviewing) return wx.showToast({ title: '正在识别，请稍候', icon: 'none' })
    const source = e.currentTarget.dataset.source === 'camera' ? ['camera'] : ['album']
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: source,
      sizeType: ['compressed'],
      success: async (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file || !file.tempFilePath) return
        if (file.size && file.size > 5 * 1024 * 1024) {
          return wx.showToast({ title: '图片超过5MB，请裁剪后上传', icon: 'none' })
        }

        this.setData({ reviewing: true, essayImage: file.tempFilePath, essayAnswer: '', essayAnswerHtml: '' })
        wx.showLoading({ title: this.data.reviewMode === 'deep' ? '深度批改中' : '快速批改中', mask: true })
        try {
          const data = await api.reviewEssayImage(file.tempFilePath, {
            topic: this.data.essayTopic || '',
            mode: this.data.reviewMode
          })
          if (data.error) {
            wx.showToast({ title: userMessage(data.error).slice(0, 28), icon: 'none' })
            return
          }
          const answer = data.answer || ''
          this.setData({ essayAnswer: answer, essayAnswerHtml: safeHtml(data.html || answer) })
          if (answer) saveRecord(this.data.essayTopic, answer)
        } catch (err) {
          wx.showToast({ title: userMessage(err).slice(0, 28), icon: 'none' })
        } finally {
          wx.hideLoading()
          this.setData({ reviewing: false })
        }
      }
    })
  },

  copyEssayAnswer() {
    if (!this.data.essayAnswer) return
    wx.setClipboardData({
      data: this.data.essayAnswer,
      success() { wx.showToast({ title: '批改结果已复制', icon: 'success' }) }
    })
  }
})
