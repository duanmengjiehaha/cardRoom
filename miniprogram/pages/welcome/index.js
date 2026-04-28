// pages/welcome/index.js
Page({
  onLoad() {
    wx.hideHomeButton();
  },
  handleUser() {
    wx.switchTab({
      url: '/pages/home/index'
    });
  },
  handleMerchant() {
    wx.navigateTo({
      url: '/pages/merchant/login/index'
    });
  }
});
