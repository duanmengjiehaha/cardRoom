const app = getApp();
const service = require('../../utils/service');
const { withLoading } = require('../../utils/loading');

Page({
  data: {
    history: []
  },

  async onShow() {
    try {
      await withLoading('\u52a0\u8f7d\u4e2d', async () => {
        await service.bootstrap().catch(() => {});
        this.setData({
          history: await service.listHistory()
        });
      });
    } catch (error) {
      wx.showToast({
        title: (error && error.message) || '\u5386\u53f2\u5546\u5bb6\u52a0\u8f7d\u5931\u8d25',
        icon: 'none'
      });
    }
  },

  goShop(e) {
    const shopId = e.currentTarget.dataset.shopid;
    app.setCurrentShopId(shopId);
    withLoading('\u8df3\u8f6c\u4e2d', async () => {
      wx.switchTab({
        url: '/pages/home/index'
      });
    });
  }
});
