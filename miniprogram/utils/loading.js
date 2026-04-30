async function withLoading(title, task) {
  wx.showLoading({
    title: title || '加载中...',
    mask: true
  });

  try {
    return await task();
  } finally {
    wx.hideLoading();
  }
}

module.exports = {
  withLoading
};
