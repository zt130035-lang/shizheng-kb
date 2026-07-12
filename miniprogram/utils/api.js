const { uploadTo, postJson, getBaseUrl } = require('./request')

module.exports = {
  reviewEssayImage: (path, data) => uploadTo('/api/essay/image-review', path, data || {}, 'file', 240000),
  ocrEssayImage: (path, data) => uploadTo('/api/essay/ocr-image', path, data || {}, 'file', 240000),
  reviewEssayText: (data) => postJson('/api/essay/review', data || {}, 240000),
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
        reject(new Error('导出失败'))
      },
      fail: reject
    })
  }),
  reviewEssaySet: (path, data) => uploadTo('/api/essay/full-review', path, data || {}, 'file', 240000),
  reviewEssaySetText: (data) => postJson('/api/essay/full-review', data || {}, 240000)
}
