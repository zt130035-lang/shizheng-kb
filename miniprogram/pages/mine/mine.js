const RECORD_KEY = 'ESSAY_REVIEW_RECORDS'
const api = require('../../utils/api')
const { getBaseUrl, DEFAULT_BASE_URL } = require('../../utils/request')

Page({
  data: {
    records: [],
    importing: false,
    baseUrl: '',
    baseUrlInput: '',
    tips: [
      '图片只用于本次批改。',
      '结果仅供练习参考。',
      '请勿上传身份证号、手机号等隐私信息。'
    ]
  },

  onShow() {
    this.loadRecords()
    this.loadBaseUrl()
  },

  loadBaseUrl() {
    const baseUrl = getBaseUrl()
    this.setData({ baseUrl, baseUrlInput: baseUrl })
  },

  onBaseUrlInput(e) {
    this.setData({ baseUrlInput: e.detail.value })
  },

  saveBaseUrl() {
    const raw = String(this.data.baseUrlInput || '').trim()
    const url = (raw || DEFAULT_BASE_URL).replace(/\/+$/, '')
    if (!/^https?:\/\//.test(url)) {
      return wx.showToast({ title: '地址需以 http:// 或 https:// 开头', icon: 'none' })
    }
    wx.setStorageSync('BASE_URL', url)
    this.setData({ baseUrl: url, baseUrlInput: url })
    wx.showToast({ title: '已保存，重新进入页面生效', icon: 'success' })
  },

  resetBaseUrl() {
    wx.setStorageSync('BASE_URL', DEFAULT_BASE_URL)
    this.setData({ baseUrl: DEFAULT_BASE_URL, baseUrlInput: DEFAULT_BASE_URL })
    wx.showToast({ title: '已恢复线上地址', icon: 'success' })
  },

  loadRecords() {
    const records = wx.getStorageSync(RECORD_KEY) || []
    this.setData({ records: Array.isArray(records) ? records : [] })
  },

  copyRecord(e) {
    const id = Number(e.currentTarget.dataset.id)
    const record = this.data.records.find(item => Number(item.id) === id)
    if (!record || !record.answer) return
    wx.setClipboardData({
      data: record.answer,
      success() { wx.showToast({ title: '已复制', icon: 'success' }) }
    })
  },

  clearRecords() {
    wx.showModal({
      title: '清空记录',
      content: '确认清空本机保存的批改记录吗？',
      success: (res) => {
        if (!res.confirm) return
        wx.removeStorageSync(RECORD_KEY)
        this.setData({ records: [] })
        wx.showToast({ title: '已清空', icon: 'success' })
      }
    })
  },

  chooseExamFile() {
    if (this.data.importing) return
    if (!wx.chooseMessageFile) {
      return wx.showToast({ title: '当前微信版本不支持聊天文件选择', icon: 'none' })
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
        this.uploadExamPaper(file)
      },
      fail: (err) => {
        if (!String((err && err.errMsg) || '').includes('cancel')) {
          wx.showToast({ title: '未能选择文件', icon: 'none' })
        }
      }
    })
  },

  async uploadExamPaper(file) {
    if (this.data.importing) return
    this.setData({ importing: true })
    wx.showLoading({ title: '上传并拆题', mask: true })
    try {
      const result = await api.importExamFile(file.path, {}, (progress) => {
        wx.showLoading({ title: `上传中 ${progress}%`, mask: true })
      })
      if (!result || result.error) {
        wx.showToast({ title: String((result && result.error) || '导入失败').slice(0, 28), icon: 'none' })
        return
      }
      wx.showModal({
        title: '导入成功',
        content: `已拆出 ${result.question_count || 0} 道题（${result.paper_id || ''}），可在「真题」tab 查看。`,
        showCancel: false
      })
    } catch (err) {
      wx.showToast({ title: String((err && err.message) || err || '导入失败').slice(0, 28), icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ importing: false })
    }
  }
})
