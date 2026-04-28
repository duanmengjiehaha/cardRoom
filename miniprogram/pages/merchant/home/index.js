// pages/merchant/home/index.js
Page({
  data: {
    shopInfo: {
      name: '棋牌室示例店铺',
      hours: '00:00 - 23:59',
      address: '示例地址 123号'
    },
    roomList: []
  },
  onShow(){
    this.getTabBar().setData({
      selected: 0
    });
    // 实际项目中应从接口获取商家自己的房间列表
    this.setData({
      roomList: wx.getStorageSync('rooms') || []
    })
  },
  lockRoom(e) {
    // 线下锁定，弹出时间选择器
    wx.showToast({ title: '功能开发中', icon: 'none' });
  }
});
