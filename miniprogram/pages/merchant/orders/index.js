const store = require('../../../utils/store');
const service = require('../../../utils/service');
const { withLoading } = require('../../../utils/loading');

Page({
  data: {
    tabs: [
      { key: 'all', label: '全部订单' },
      { key: 'pending', label: '待核销' },
      { key: 'completed', label: '已核销' },
      { key: 'cancelled', label: '已取消' }
    ],
    activeTab: 'all',
    allOrders: [],
    filteredOrders: [],
    shopId: '',
    searchPhoneSuffix: '',
    texts: {
      anonymousUser: '匿名客户',
      noPhone: '未填写手机号',
      verifyNow: '一键核销',
      empty: '暂无订单',
      searchPlaceholder: '输入手机号后四位'
    }
  },

  async onShow() {
    await withLoading('加载中', async () => {
      await service.bootstrap().catch(() => {});
      const merchant = store.getCurrentMerchant();
      if (!merchant) {
        wx.redirectTo({ url: '/pages/merchant/login/index' });
        return;
      }
      await this.loadOrders(merchant.shopId);
    });
  },

  async loadOrders(shopId) {
    const allOrders = await service.listMerchantOrders(shopId);
    this.setData({
      allOrders,
      shopId
    });
    this.filterOrders();
  },

  handleTabChange(e) {
    this.setData({ activeTab: e.detail.name || 'all' });
    this.filterOrders();
  },

  handleSearchInput(e) {
    this.setData({
      searchPhoneSuffix: String((e.detail && e.detail.value) || '').replace(/\D/g, '').slice(0, 4)
    });
    this.filterOrders();
  },

  filterOrders() {
    const { allOrders, activeTab, searchPhoneSuffix } = this.data;
    const filteredOrders = allOrders.filter((item) => {
      const matchTab = activeTab === 'all' || item.status === activeTab;
      if (!matchTab) {
        return false;
      }
      if (!searchPhoneSuffix) {
        return true;
      }
      const phone = String(item.phone || '');
      return phone.slice(-4).includes(searchPhoneSuffix);
    });
    this.setData({ filteredOrders });
  },

  verifyOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认核销',
      content: '确认用户已经到店并完成核验吗？',
      success: async ({ confirm }) => {
        if (!confirm) {
          return;
        }
        const result = await withLoading('核销中', () => service.verifyOrder(orderId, this.data.shopId));
        if (!result.ok) {
          wx.showToast({ title: result.message || '核销失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: '核销成功', icon: 'success' });
        await withLoading('刷新中', () => this.loadOrders(this.data.shopId));
      }
    });
  }
});
