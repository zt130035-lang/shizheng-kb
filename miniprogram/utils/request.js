const DEFAULT_BASE_URL = 'https://shizheng-kb.onrender.com'
const MAX_RETRY = 2
const RETRY_BASE_DELAY = 1000

function getBaseUrl() {
  return String(wx.getStorageSync('BASE_URL') || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

// 设备级匿名用户标识:首次启动生成随机 id 并持久化,用于后端按用户隔离数据(X-User-Id)
function ensureUserId() {
  let uid = wx.getStorageSync('USER_ID')
  if (!uid) {
    uid = 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
    wx.setStorageSync('USER_ID', uid)
  }
  return uid
}

function essayFallback() {
  return { error: '图片批改失败，请稍后重试或换一张更清晰的图片' }
}

// 按状态码给出友好提示
function friendlyError(statusCode, body) {
  const code = Number(statusCode)
  if (code === 401) return '服务认证失败，请检查后端配置'
  if (code === 403) return '无权访问该功能'
  if (code === 404) return '内容不存在'
  if (code === 413) return '文件过大，请压缩后重试'
  if (code === 429) {
    const after = body && body.retry_after
    return after ? `请求过于频繁，请${after}秒后再试` : '请求过于频繁，请稍后再试'
  }
  if (code >= 500) return '服务器繁忙，请稍后重试'
  return (body && (body.error || body.message)) || `请求失败 ${code}`
}

// 哪些情况值得重试:429 限流(未消耗 AI)、5xx 服务端错误、超时/网络(请求可能未到达)
function shouldRetry(statusCode, timeout) {
  if (timeout) return true
  const code = Number(statusCode)
  return code === 429 || code >= 500
}

function uploadTo(url, path, formData = {}, name = 'file', timeout = 180000, onProgress) {
  const fullUrl = /^https?:\/\//.test(url) ? url : getBaseUrl() + url
  return new Promise((resolve) => {
    const attempt = (retry) => {
      const retryOrResolve = (outcome) => {
        if (shouldRetry(outcome.statusCode, outcome.timeout) && retry < MAX_RETRY) {
          setTimeout(() => attempt(retry + 1), RETRY_BASE_DELAY * Math.pow(2, retry))
          return
        }
        resolve(outcome)
      }
      const task = wx.uploadFile({
        url: fullUrl,
        filePath: path,
        name,
        formData,
        header: { 'X-User-Id': ensureUserId() },
        timeout,
        success(res) {
          let data = {}
          try { data = JSON.parse(res.data || '{}') } catch (e) { /* 非 JSON 响应 */ }
          if (res.statusCode >= 200 && res.statusCode < 300) return retryOrResolve({ data })
          return retryOrResolve({ statusCode: res.statusCode, data, error: friendlyError(res.statusCode, data) })
        },
        fail(err) {
          const errMsg = err && err.errMsg ? err.errMsg : 'upload fail'
          const timeoutFlag = String(errMsg).toLowerCase().includes('timeout')
          if (!timeoutFlag) wx.showToast({ title: '上传失败', icon: 'none' })
          retryOrResolve({ timeout: timeoutFlag, error: timeoutFlag ? '上传超时' : '网络请求失败' })
        }
      })
      if (onProgress && task && task.onProgressUpdate) {
        task.onProgressUpdate(res => onProgress((res && res.progress) || 0))
      }
    }
    attempt(0)
  })
}

function postJson(url, data = {}, timeout = 180000) {
  const fullUrl = /^https?:\/\//.test(url) ? url : getBaseUrl() + url
  return new Promise((resolve) => {
    const attempt = (retry) => {
      const retryOrResolve = (outcome) => {
        if (shouldRetry(outcome.statusCode, outcome.timeout) && retry < MAX_RETRY) {
          setTimeout(() => attempt(retry + 1), RETRY_BASE_DELAY * Math.pow(2, retry))
          return
        }
        resolve(outcome)
      }
      wx.request({
        url: fullUrl,
        method: 'POST',
        data,
        timeout,
        header: { 'content-type': 'application/json', 'X-User-Id': ensureUserId() },
        success(res) {
          const body = res.data || {}
          if (res.statusCode >= 200 && res.statusCode < 300) return retryOrResolve(body)
          const merged = (typeof body === 'object' && body) ? body : {}
          retryOrResolve({ statusCode: res.statusCode, ...merged, error: friendlyError(res.statusCode, body) })
        },
        fail(err) {
          const errMsg = err && err.errMsg ? err.errMsg : 'request fail'
          const timeoutFlag = String(errMsg).toLowerCase().includes('timeout')
          retryOrResolve({ timeout: timeoutFlag, error: timeoutFlag ? '请求超时' : '网络请求失败' })
        }
      })
    }
    attempt(0)
  })
}

module.exports = { uploadTo, postJson, getBaseUrl, DEFAULT_BASE_URL, ensureUserId }
