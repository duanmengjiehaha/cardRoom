// pages/merchant/orders/index.js
Page({
  data: {
    activeTab: '待核销',
    tabs: ['待核销', '已核销', '已取消'],
    allOrders: [],
    filteredOrders: []
  },

  onShow() {
    // 从本地缓存加载用户提交的订单
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
    const filtered = allOrders.filter(order => {
        if (activeTab === '已核销') return order.status === '已完成'; // 用户的'已完成'对应商家的'已核销'
        return order.status === activeTab;
    });
    this.setData({ filteredOrders: filtered });
  },

  verifyOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认核销',
      content: '请确认用户已到店，核销后订单将完成。',
      success: (res) => {
        if (res.confirm) {
          const newOrders = this.data.allOrders.map(order => {
            if (order.id === orderId) {
              return { ...order, status: '已完成', statusColor: 'gray' };
            }
            return order;
          });
          wx.setStorageSync('orders', newOrders);
          this.setData({ allOrders: newOrders });
          this.filterOrders();
          wx.showToast({ title: '核销成功', icon: 'success' });
        }
      }
    });
  }
});
