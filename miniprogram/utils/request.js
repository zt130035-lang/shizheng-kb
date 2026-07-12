const DEFAULT_BASE_URL = 'https://shizheng-kb.onrender.com'

function getBaseUrl() {
  return String(wx.getStorageSync('BASE_URL') || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

function essayFallback() {
  return { error: '图片批改失败，请稍后重试或换一张更清晰的图片' }
}

function uploadTo(url, path, formData = {}, name = 'file', timeout = 180000) {
  const fullUrl = /^https?:\/\//.test(url) ? url : getBaseUrl() + url
  console.log('[upload start]', fullUrl)
  return new Promise((resolve) => {
    wx.uploadFile({
      url: fullUrl,
      filePath: path,
      name,
      formData,
      timeout,
      success(res) {
        console.log('[upload success]', fullUrl, res.statusCode)
        try {
          const data = JSON.parse(res.data || '{}')
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve(data)
          return resolve({ error: data.error || data.message || `图片批改失败 ${res.statusCode}` })
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve({ answer: res.data || '' })
          return resolve({ error: `图片批改失败 ${res.statusCode}` })
        }
      },
      fail(err) {
        const errMsg = err && err.errMsg ? err.errMsg : 'upload fail'
        console.warn('[upload fail]', fullUrl, errMsg)
        if (!String(errMsg).toLowerCase().includes('timeout')) {
          wx.showToast({ title: '上传失败', icon: 'none' })
        }
        resolve(essayFallback())
      }
    })
  })
}

function postJson(url, data = {}, timeout = 180000) {
  const fullUrl = /^https?:\/\//.test(url) ? url : getBaseUrl() + url
  console.log('[request start]', fullUrl)
  return new Promise((resolve) => {
    wx.request({
      url: fullUrl,
      method: 'POST',
      data,
      timeout,
      header: { 'content-type': 'application/json' },
      success(res) {
        const body = res.data || {}
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(body)
        resolve({ error: body.error || body.message || `请求失败 ${res.statusCode}` })
      },
      fail(err) {
        const errMsg = err && err.errMsg ? err.errMsg : 'request fail'
        console.warn('[request fail]', fullUrl, errMsg)
        resolve({ error: String(errMsg).toLowerCase().includes('timeout') ? '请求超时' : '网络请求失败' })
      }
    })
  })
}

module.exports = { uploadTo, postJson, getBaseUrl, DEFAULT_BASE_URL }
