const { uploadTo, getJson, postJson, getBaseUrl } = require('./request')

module.exports = {
  reviewEssayImage: (path, data, onProgress) => uploadTo('/api/essay/image-review', path, data || {}, 'file', 240000, onProgress),
  ocrEssayImage: (path, data, onProgress) => uploadTo('/api/essay/ocr-image', path, data || {}, 'file', 240000, onProgress),
  uploadPaperFile: (path, onProgress) => uploadTo('/api/essay/paper-upload', path, {}, 'file', 180000, onProgress),
  reviewEssayText: (data) => postJson('/api/essay/review', data || {}, 300000),
  exportEssay: (data) => new Promise((resolve, reject) => {
    wx.request({
      url: getBaseUrl() + '/api/essay/export',
      method: 'POST',
      data: data || {},
      timeout: 120000,
      responseType: 'arraybuffer',
      header: { 'content-type': 'application/json' },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(res.data)
        const body = res.data || {}
        reject(new Error(body.error || body.message || '导出失败'))
      },
      fail: reject
    })
  }),
  reviewEssaySet: (path, data, onProgress) => uploadTo('/api/essay/full-review', path, data || {}, 'file', 480000, onProgress),
  reviewEssaySetText: (data) => postJson('/api/essay/full-review', data || {}, 480000),

  // 真题库（国考行政执法卷 · 逐题答案）
  listExamPapers: () => getJson('/api/exam/papers', {}, 20000),
  getExamPaper: (paperId) => getJson(`/api/exam/papers/${encodeURIComponent(paperId)}`, {}, 20000),
  generateExamAnswer: (paperId, qid, force) => postJson(
    `/api/exam/papers/${encodeURIComponent(paperId)}/questions/${encodeURIComponent(qid)}/answer`,
    { force: !!force },
    300000
  ),
  imitateExam: (data) => postJson('/api/exam/imitate', data || {}, 300000),
  generateExamPaperAnswers: (paperId, force) => postJson(
    `/api/exam/papers/${encodeURIComponent(paperId)}/generate-all`,
    { force: !!force },
    60000
  ),
  getExamGenerateStatus: (paperId) => getJson(
    `/api/exam/papers/${encodeURIComponent(paperId)}/generate-status`,
    {},
    20000
  ),
  importExamFile: (path, formData, onProgress) => uploadTo('/api/exam/import', path, formData || {}, 'file', 300000, onProgress)
}