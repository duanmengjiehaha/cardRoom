// pages/merchant/dashboard/index.js
Page({
  data: {
    stats: {
      total: 12,
      idle: 8,
      booked: 3,
      orders: 26
    }
  },

  onLoad() {
    // 设置导航栏右上角的退出按钮
    // 实际项目中，这里可以添加一个胶囊按钮的扩展
  },

  navigateTo(e) {
    const page = e.currentTarget.dataset.page;
    wx.navigateTo({
      url: `/pages/merchant/${page}/index`
    });
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出商家后台吗？',
      success: (res) => {
        if (res.confirm) {
          // 清理商家登录状态，然后跳转到身份选择页
          wx.reLaunch({
            url: '/pages/welcome/index'
          });
        }
      }
    });
  }
});
