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
    paperFileToken: '',
    paperFileName: '',
    answerText: '',
    answerImages: [],
    materialImages: [],
    referenceText: '',
    referenceFileToken: '',
    referenceFileName: '',
    fullReview: null,
    essayTopic: '',
    essayImage: '',
    essayImages: [],
    essayExtractedText: '',
    essayAnswer: '',
    essayAnswerHtml: '',
    uploadProgressText: '',
    reviewing: false,
    reviewMode: 'fast'
  },

  onShow() {
    const result = wx.getStorageSync('PAPER_UPLOAD_RESULT')
    if (!result) return
    wx.removeStorageSync('PAPER_UPLOAD_RESULT')
    if (result.type === 'essay-reference') {
      return this.setData({
        referenceFileToken: result.paper_id || '',
        referenceFileName: result.filename || '已选参考答案',
        referenceText: ''
      })
    }
    if (result.type !== 'essay-paper') return
    this.setData({
      paperFilePath: '',
      paperFileToken: result.paper_id || '',
      paperFileName: result.filename || '已选择手机本地试卷',
      paperText: '',
      fullReview: null
    })
  },

  setReviewKind(e) {
    if (this.data.reviewing) return
    const kind = e.currentTarget.dataset.kind === 'image' ? 'image' : 'full'
    this.setData({ reviewKind: kind })
  },

  onPaperTitleInput(e) { this.setData({ paperTitle: e.detail.value }) },
  onPaperTextInput(e) { this.setData({ paperText: e.detail.value }) },
  onAnswerInput(e) { this.setData({ answerText: e.detail.value }) },
  onReferenceTextInput(e) { this.setData({ referenceText: e.detail.value, referenceFileToken: '' }) },
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
        files.forEach(file => wx.getImageInfo({
          src: file.tempFilePath,
          success: info => {
            if (info.width < 800 || info.height < 800) wx.showToast({ title: '图片较小，识别可能不准', icon: 'none' })
          }
        }))
      }
    })
  },

  removeAnswerImage(e) {
    const index = Number(e.currentTarget.dataset.index)
    const answerImages = this.data.answerImages.slice()
    if (Number.isInteger(index) && index >= 0) answerImages.splice(index, 1)
    this.setData({ answerImages })
  },

  moveAnswerImage(e) {
    const index = Number(e.currentTarget.dataset.index)
    const direction = e.currentTarget.dataset.direction === 'up' ? -1 : 1
    const target = index + direction
    const answerImages = this.data.answerImages.slice()
    if (index < 0 || target < 0 || target >= answerImages.length) return
    const current = answerImages[index]
    answerImages[index] = answerImages[target]
    answerImages[target] = current
    this.setData({ answerImages })
  },

  choosePaperFile() {
    if (this.data.reviewing) return
    wx.showActionSheet({
      itemList: ['相册图片', '拍照图片', '微信聊天文件'],
      success: (res) => {
        if (res.tapIndex === 0) return this.chooseMaterialImages(['album'])
        if (res.tapIndex === 1) return this.chooseMaterialImages(['camera'])
        this.chooseChatPaperFile()
      }
    })
  },

  chooseMaterialImages(source) {
    wx.chooseMedia({
      count: source[0] === 'camera' ? 1 : 9,
      mediaType: ['image'],
      sourceType: source,
      sizeType: ['compressed'],
      success: (res) => {
        const files = (res.tempFiles || []).slice(0, 9)
        if (!files.length) return
        if (files.some(file => file.size && file.size > 7 * 1024 * 1024)) return wx.showToast({ title: '单张材料图片不能超过7MB', icon: 'none' })
        this.setData({
          paperFilePath: '',
          paperFileToken: '',
          paperFileName: '',
          materialImages: files.map(file => ({ path: file.tempFilePath, name: file.name || '材料图片', size: file.size || 0 }))
        })
        files.forEach(file => wx.getImageInfo({
          src: file.tempFilePath,
          success: info => {
            if (info.width < 800 || info.height < 800) wx.showToast({ title: '图片较小，识别可能不准', icon: 'none' })
          }
        }))
      }
    })
  },

  removeMaterialImage(e) {
    const index = Number(e.currentTarget.dataset.index)
    const materialImages = this.data.materialImages.slice()
    if (Number.isInteger(index) && index >= 0) materialImages.splice(index, 1)
    this.setData({ materialImages })
  },

  moveMaterialImage(e) {
    const index = Number(e.currentTarget.dataset.index)
    const target = index + (e.currentTarget.dataset.direction === 'up' ? -1 : 1)
    const materialImages = this.data.materialImages.slice()
    if (index < 0 || target < 0 || target >= materialImages.length) return
    const current = materialImages[index]
    materialImages[index] = materialImages[target]
    materialImages[target] = current
    this.setData({ materialImages })
  },

  openReferencePicker() {
    this.chooseChatReferenceFile()
  },

  chooseChatPaperFile() {
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
        this.setData({
          paperFilePath: file.path,
          paperFileToken: '',
          paperFileName: file.name || '已选择整套试卷',
          materialImages: [],
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

  chooseChatReferenceFile() {
    if (!wx.chooseMessageFile) return wx.showToast({ title: '当前版本不支持聊天文件', icon: 'none' })
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf', 'docx', 'txt', 'md'],
      success: async (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file || !file.path) return
        if (file.size && file.size > 25 * 1024 * 1024) return wx.showToast({ title: '文件超过25MB', icon: 'none' })
        wx.showLoading({ title: '读取参考答案', mask: true })
        try {
          const result = await api.uploadPaperFile(file.path)
          if (result.error) return wx.showToast({ title: userMessage(result.error).slice(0, 28), icon: 'none' })
          this.setData({ referenceFileToken: result.paper_id || '', referenceFileName: file.name || '已选参考答案', referenceText: '' })
        } finally {
          wx.hideLoading()
        }
      }
    })
  },

  async submitFullReview() {
    if (this.data.reviewing) return
    if (!this.data.paperFilePath && !this.data.paperFileToken && !this.data.materialImages.length && this.data.paperText.trim().length < 20) {
      return wx.showToast({ title: '请上传或粘贴材料与题目', icon: 'none' })
    }
    this.setData({ reviewing: true, fullReview: null, essayAnswer: '', essayAnswerHtml: '', uploadProgressText: '' })
    wx.showLoading({ title: this.data.answerImages.length ? '识别答案图片' : (this.data.answerText.trim() ? '整套批改中' : '生成参考答案'), mask: true })
    try {
      let imageMaterial = ''
      if (this.data.materialImages.length) {
        const materialParts = []
        for (let index = 0; index < this.data.materialImages.length; index += 1) {
          this.setData({ uploadProgressText: `正在识别材料图片 ${index + 1}/${this.data.materialImages.length}` })
          const ocr = await api.ocrEssayImage(this.data.materialImages[index].path, { page: String(index + 1) })
          if (ocr.error) throw new Error(`第${index + 1}张材料图片：${userMessage(ocr.error)}`)
          if (ocr.text) materialParts.push(`第${index + 1}页材料：\n${ocr.text}`)
        }
        imageMaterial = materialParts.join('\n\n')
      }
      let imageAnswer = ''
      if (this.data.answerImages.length) {
        const ocrParts = []
        for (let index = 0; index < this.data.answerImages.length; index += 1) {
          const item = this.data.answerImages[index]
          this.setData({ uploadProgressText: `正在识别答案图片 ${index + 1}/${this.data.answerImages.length}` })
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
        paper_text: [this.data.paperText.trim(), imageMaterial].filter(Boolean).join('\n\n'),
        paper_id: this.data.paperFileToken,
        reference_text: this.data.referenceText.trim(),
        reference_id: this.data.referenceFileToken,
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
      this.setData({ reviewing: false, uploadProgressText: '' })
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
      count: source[0] === 'camera' ? 1 : 9,
      mediaType: ['image'],
      sourceType: source,
      sizeType: ['compressed'],
      success: (res) => {
        const files = (res.tempFiles || []).slice(0, 9)
        if (!files.length) return
        if (files.some(file => file.size && file.size > 5 * 1024 * 1024)) {
          return wx.showToast({ title: '单张图片超过5MB，请裁剪后上传', icon: 'none' })
        }
        this.setData({
          essayImage: files[0].tempFilePath,
          essayImages: files.map(file => ({ path: file.tempFilePath, name: file.name || '作文图片', size: file.size || 0 })),
          essayExtractedText: '',
          essayAnswer: '',
          essayAnswerHtml: ''
        })
        files.forEach(file => wx.getImageInfo({
          src: file.tempFilePath,
          success: info => {
            if (info.width < 800 || info.height < 800) wx.showToast({ title: '图片较小，识别可能不准', icon: 'none' })
          }
        }))
      }
    })
  },

  removeEssayImage(e) {
    const index = Number(e.currentTarget.dataset.index)
    const essayImages = this.data.essayImages.slice()
    if (Number.isInteger(index) && index >= 0) essayImages.splice(index, 1)
    this.setData({
      essayImages,
      essayImage: essayImages.length ? essayImages[0].path : ''
    })
  },

  moveEssayImage(e) {
    const index = Number(e.currentTarget.dataset.index)
    const direction = e.currentTarget.dataset.direction === 'up' ? -1 : 1
    const target = index + direction
    const essayImages = this.data.essayImages.slice()
    if (index < 0 || target < 0 || target >= essayImages.length) return
    const current = essayImages[index]
    essayImages[index] = essayImages[target]
    essayImages[target] = current
    this.setData({ essayImages, essayImage: essayImages[0].path })
  },

  async startEssayReview() {
    if (this.data.reviewing) return
    const images = this.data.essayImages || []
    if (!images.length) return wx.showToast({ title: '请先选择作文图片', icon: 'none' })
    this.setData({ reviewing: true, essayExtractedText: '', essayAnswer: '', essayAnswerHtml: '', uploadProgressText: '' })
    wx.showLoading({ title: images.length > 1 ? '识别多页作文' : '图片批改中', mask: true })
    try {
      let data
      if (images.length === 1) {
        data = await api.reviewEssayImage(images[0].path, {
          topic: this.data.essayTopic || '',
          mode: this.data.reviewMode
        })
      } else {
        const parts = []
        for (let index = 0; index < images.length; index += 1) {
          this.setData({ uploadProgressText: `正在识别作文图片 ${index + 1}/${images.length}` })
          const ocr = await api.ocrEssayImage(images[index].path, { page: String(index + 1) })
          if (ocr.error) throw new Error(`第${index + 1}张图片：${userMessage(ocr.error)}`)
          if (ocr.text) parts.push(`第${index + 1}页作文：\n${ocr.text}`)
        }
        const essay = parts.join('\n\n')
        if (essay.length < 50) throw new Error('多张图片未识别出足够文字，请上传更清晰的照片')
        this.setData({ essayExtractedText: essay })
        wx.showLoading({ title: '整合多页并批改', mask: true })
        data = await api.reviewEssayText({ topic: this.data.essayTopic || '', essay })
      }
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
      this.setData({ reviewing: false, uploadProgressText: '' })
    }
  },

  copyEssayAnswer() {
    if (!this.data.essayAnswer) return
    wx.setClipboardData({
      data: this.data.essayAnswer,
      success() { wx.showToast({ title: '批改结果已复制', icon: 'success' }) }
    })
  },

  exportReview(e) {
    if (!this.data.essayAnswer || this.data.reviewing) return
    const format = e.currentTarget.dataset.format === 'pdf' ? 'pdf' : 'docx'
    wx.showLoading({ title: '生成文件', mask: true })
    api.exportEssay({
      title: this.data.paperTitle || this.data.essayTopic || '申论批改结果',
      answer: this.data.essayAnswer,
      format
    }).then((buffer) => {
      const filePath = `${wx.env.USER_DATA_PATH}/essay-review.${format}`
      wx.getFileSystemManager().writeFile({
        filePath,
        data: buffer,
        success: () => wx.openDocument({
          filePath,
          fileType: format,
          showMenu: true,
          fail: () => wx.showToast({ title: '文件已生成', icon: 'success' })
        }),
        fail: () => wx.showToast({ title: '保存失败', icon: 'none' })
      })
    }).catch((err) => wx.showToast({ title: userMessage(err).slice(0, 28), icon: 'none' }))
      .finally(() => wx.hideLoading())
  }
})
