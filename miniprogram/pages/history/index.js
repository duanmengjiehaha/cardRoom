// pages/history/index.js
Page({
  data: {
    history: []
  },

  onShow() {
    const history = wx.getStorageSync('shopHistory') || [];
    this.setData({ history });
  },

  reBook(e) {
    // 这里可以根据 shopId 跳转到对应的商家首页
    // 为简化，我们直接跳转到首页
    wx.switchTab({
      url: '/pages/home/index'
    });
  }
});
