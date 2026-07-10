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
  if (msg.includes('timeout') || msg.includes('超时')) return '识别耗时较长，请稍后重试'
  if (msg.includes('413') || msg.includes('过大')) return '图片过大，请裁剪后上传'
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
    essayTopic: '',
    essayImage: '',
    essayAnswer: '',
    essayAnswerHtml: '',
    reviewing: false
  },

  onTopicInput(e) {
    this.setData({ essayTopic: e.detail.value })
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

        this.setData({
          reviewing: true,
          essayImage: file.tempFilePath,
          essayAnswer: '',
          essayAnswerHtml: ''
        })
        wx.showLoading({ title: '识别批改中', mask: true })
        try {
          const data = await api.reviewEssayImage(file.tempFilePath, {
            topic: this.data.essayTopic || '',
            mode: 'review'
          })
          if (data.error) {
            wx.showToast({ title: userMessage(data.error).slice(0, 28), icon: 'none' })
            return
          }
          const answer = data.answer || ''
          const html = safeHtml(data.html || answer || '')
          this.setData({
            essayAnswer: answer,
            essayAnswerHtml: html
          })
          if (answer) saveRecord(this.data.essayTopic, answer)
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