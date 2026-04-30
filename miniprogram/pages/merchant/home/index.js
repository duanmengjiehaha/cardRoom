const app = getApp();
const store = require('../../../utils/store');
const service = require('../../../utils/service');
const { withLoading } = require('../../../utils/loading');

function todayLabel() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function getFieldValue(detail) {
  if (typeof detail === 'string') {
    return detail;
  }
  if (detail && typeof detail.value !== 'undefined') {
    return detail.value;
  }
  return '';
}

Page({
  data: {
    shopInfo: null,
    stats: {
      totalRooms: 0,
      idleRooms: 0,
      bookedRooms: 0,
      usingRooms: 0,
      todayOrders: 0
    },
    roomList: [],
    texts: {
      addressPrefix: '\u5730\u5740\uff1a',
      businessHoursPrefix: '\u8425\u4e1a\u65f6\u95f4\uff1a',
      totalRooms: '\u623f\u95f4',
      idleRooms: '\u7a7a\u95f2',
      bookedRooms: '\u5df2\u9884\u7ea6',
      usingRooms: '\u4f7f\u7528\u4e2d',
      addRoom: '\u65b0\u589e\u623f\u95f4',
      bookingOrders: '\u9884\u7ea6\u8ba2\u5355',
      businessOpen: '\u8425\u4e1a\u4e2d',
      offlineLock: '\u7ebf\u4e0b\u9501\u53f0',
      editRoom: '\u4fee\u6539\u623f\u95f4',
      deleteRoom: '\u5220\u9664\u623f\u95f4',
      popupTitle: '\u7ebf\u4e0b\u9501\u53f0',
      customerLabel: '\u5ba2\u6237',
      customerPlaceholder: '\u586b\u5199\u59d3\u540d',
      phoneLabel: '\u7535\u8bdd',
      phonePlaceholder: '\u586b\u5199\u624b\u673a\u53f7',
      start: '\u5f00\u59cb',
      end: '\u7ed3\u675f',
      cancel: '\u53d6\u6d88',
      confirmLock: '\u786e\u8ba4\u9501\u53f0'
    },
    showLockModal: false,
    lockRoomId: '',
    lockRoomName: '',
    lockForm: {
      customerName: '',
      phone: '',
      startTime: '14:00',
      endTime: '15:00'
    }
  },

  async onShow() {
    await withLoading('\u52a0\u8f7d\u4e2d', async () => {
      const merchant = store.getCurrentMerchant();
      if (!merchant) {
        wx.redirectTo({ url: '/pages/merchant/login/index' });
        return;
      }
      app.setRole('merchant');
      app.setCurrentShopId(merchant.shopId);
      await this.loadPage(merchant.shopId);
      const tabBar = this.getTabBar();
      if (tabBar && tabBar.init) {
        tabBar.init();
      }
    });
  },

  loadPage(shopId) {
    return service.getMerchantDashboard(shopId).then((dashboard) => {
      this.setData({
        shopInfo: dashboard.shop,
        stats: dashboard.stats,
        roomList: dashboard.roomList
      });
    });
  },

  navigateTo(e) {
    withLoading('\u8df3\u8f6c\u4e2d', async () => {
      wx.navigateTo({
        url: e.currentTarget.dataset.url
      });
    });
  },

  openLockModal(e) {
    withLoading('\u8df3\u8f6c\u4e2d', async () => {
      wx.navigateTo({
        url: `/pages/merchant/lock-create/index?roomId=${e.currentTarget.dataset.id}`
      });
    });
  },

  openRoomEdit(e) {
    withLoading('\u8df3\u8f6c\u4e2d', async () => {
      wx.navigateTo({
        url: `/pages/merchant/room-edit/index?roomId=${e.currentTarget.dataset.id}`
      });
    });
  },

  hideLockModal() {
    this.setData({ showLockModal: false });
  },

  handleLockInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`lockForm.${field}`]: getFieldValue(e.detail)
    });
  },

  async submitLock() {
    const { lockForm, lockRoomId, shopInfo } = this.data;
    let startAt = new Date(`${todayLabel()}T${lockForm.startTime}:00`).getTime();
    let endAt = new Date(`${todayLabel()}T${lockForm.endTime}:00`).getTime();
    if (endAt <= startAt) {
      endAt += 24 * 60 * 60 * 1000;
    }
    const result = await withLoading('\u9501\u53f0\u4e2d', async () => service.createOfflineLock({
      shopId: shopInfo.id,
      roomId: lockRoomId,
      customerName: lockForm.customerName.trim(),
      phone: lockForm.phone.trim(),
      startAt,
      endAt
    }));
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' });
      return;
    }
    wx.showToast({ title: '\u9501\u53f0\u6210\u529f', icon: 'success' });
    this.hideLockModal();
    this.loadPage(shopInfo.id);
  },

  deleteRoom(e) {
    const roomId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '\u5220\u9664\u623f\u95f4',
      content: '\u5220\u9664\u540e\u4e0d\u53ef\u6062\u590d\uff0c\u786e\u8ba4\u7ee7\u7eed\u5417\uff1f',
      success: async ({ confirm }) => {
        if (!confirm) {
          return;
        }
        const result = await withLoading('\u5220\u9664\u4e2d', async () => service.removeRoom(roomId, this.data.shopInfo.id));
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' });
          return;
        }
        wx.showToast({ title: '\u623f\u95f4\u5df2\u5220\u9664', icon: 'success' });
        await withLoading('\u5237\u65b0\u4e2d', async () => {
          this.loadPage(this.data.shopInfo.id);
        });
      }
    });
  }
});
