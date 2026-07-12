const { uploadTo, postJson } = require('./request')

module.exports = {
  reviewEssayImage: (path, data) => uploadTo('/api/essay/image-review', path, data || {}, 'file', 240000),
  reviewEssaySet: (path, data) => uploadTo('/api/essay/full-review', path, data || {}, 'file', 240000),
  reviewEssaySetText: (data) => postJson('/api/essay/full-review', data || {}, 240000)
}
