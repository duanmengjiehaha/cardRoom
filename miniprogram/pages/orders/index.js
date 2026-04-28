// pages/orders/index.js
Page({
  data: {
    activeTab: '待使用',
    tabs: ['全部', '待使用', '已完成', '已取消'],
    allOrders: [],
    filteredOrders: []
  },

  onShow() {
    const orders = wx.getStorageSync('orders') || [];
    this.setData({ allOrders: orders });
    this.filterOrders();
  },

  changeTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this.filterOrders();
  },

  filterOrders() {
    const { activeTab, allOrders } = this.data;
    if (activeTab === '全部') {
      this.setData({ filteredOrders: allOrders });
      return;
    }
    const filtered = allOrders.filter(order => order.status === activeTab);
    this.setData({ filteredOrders: filtered });
  },

  cancelOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '确认取消本次预约吗？',
      success: (res) => {
        if (res.confirm) {
          const newOrders = this.data.allOrders.map(order => {
            if (order.id === orderId) {
              return { ...order, status: '已取消', statusColor: 'red' };
            }
            return order;
          });
          wx.setStorageSync('orders', newOrders);
          this.setData({ allOrders: newOrders });
          this.filterOrders();
        }
      }
    });
  }
});
