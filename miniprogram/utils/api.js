const { uploadTo } = require('./request')

module.exports = {
  reviewEssayImage: (path, data) => uploadTo('/api/essay/image-review', path, data || {}, 'file', 240000)
}
