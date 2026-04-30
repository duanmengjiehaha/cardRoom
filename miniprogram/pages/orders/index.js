const mock = require('../../utils/mock');
const service = require('../../utils/service');
const { withLoading } = require('../../utils/loading');

Page({
  data: {
    tabs: [
      { key: 'all', label: '\u5168\u90e8' },
      { key: 'pending', label: '\u5f85\u4f7f\u7528' },
      { key: 'completed', label: '\u5df2\u5b8c\u6210' },
      { key: 'cancelled', label: '\u5df2\u53d6\u6d88' }
    ],
    activeTab: 'all',
    allOrders: [],
    filteredOrders: [],
    texts: {
      cancelBooking: '\u53d6\u6d88\u9884\u7ea6',
      empty: '\u6682\u65e0\u8ba2\u5355'
    }
  },

  async onShow() {
    try {
      await withLoading('\u52a0\u8f7d\u4e2d', async () => {
        await service.bootstrap().catch(() => {});
        const allOrders = await service.listUserOrders();
        this.setData({ allOrders });
        this.filterOrders();
      });
    } catch (error) {
      wx.showToast({
        title: (error && error.message) || '\u8ba2\u5355\u52a0\u8f7d\u5931\u8d25',
        icon: 'none'
      });
    }
  },

  handleTabChange(e) {
    this.setData({ activeTab: e.detail.name || 'all' });
    this.filterOrders();
  },

  filterOrders() {
    const { activeTab, allOrders } = this.data;
    const filteredOrders = activeTab === 'all'
      ? allOrders
      : allOrders.filter((item) => item.status === activeTab);
    this.setData({ filteredOrders });
  },

  cancelOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '\u53d6\u6d88\u9884\u7ea6',
      content: '\u786e\u8ba4\u53d6\u6d88\u672c\u6b21\u9884\u7ea6\u5417\uff1f\u5df2\u5360\u7528\u65f6\u6bb5\u4f1a\u7acb\u5373\u91ca\u653e\u3002',
      success: async ({ confirm }) => {
        if (!confirm) {
          return;
        }
        const result = await withLoading('\u5904\u7406\u4e2d', () => service.cancelOrder(orderId));
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' });
          return;
        }
        wx.showToast({ title: '\u5df2\u53d6\u6d88', icon: 'success' });
        try {
          const allOrders = await withLoading('\u5237\u65b0\u4e2d', () => service.listUserOrders());
          this.setData({ allOrders });
          this.filterOrders();
        } catch (error) {
          wx.showToast({
            title: (error && error.message) || '\u8ba2\u5355\u5237\u65b0\u5931\u8d25',
            icon: 'none'
          });
        }
      }
    });
  }
});
