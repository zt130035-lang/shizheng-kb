function safeHtml(html) {
  if (!html) return '<p>暂无内容</p>'
  return String(html).replace(/target="_blank"/g, '')
}
function optionArray(options) {
  if (!options) return []
  return Object.keys(options).sort().map(key => ({ key, text: options[key] }))
}
module.exports = { safeHtml, optionArray }
