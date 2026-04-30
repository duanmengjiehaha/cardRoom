const app = getApp();
const service = require('../../utils/service');
const store = require('../../utils/store');
const { withLoading } = require('../../utils/loading');

function getShopBusinessStatus(shop) {
  if (!shop || !shop.hours) {
    return {
      text: '\u8425\u4e1a\u4e2d',
      active: true
    };
  }

  const now = new Date();
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const [openHour, openMinute] = String(shop.hours.open || '00:00').split(':').map(Number);
  const [closeHour, closeMinute] = String(shop.hours.close || '23:59').split(':').map(Number);
  const open = (openHour || 0) * 60 + (openMinute || 0);
  const close = (closeHour || 0) * 60 + (closeMinute || 0);

  let active = false;
  if (open === close) {
    active = true;
  } else if (open < close) {
    active = currentMinute >= open && currentMinute < close;
  } else {
    active = currentMinute >= open || currentMinute < close;
  }

  return {
    text: active ? '\u8425\u4e1a\u4e2d' : '\u4f11\u606f\u4e2d',
    active
  };
}

Page({
  data: {
    isMerchant: false,
    shopInfo: null,
    roomList: [],
    stats: {
      totalRooms: 0,
      idleRooms: 0,
      bookedRooms: 0,
      usingRooms: 0,
      todayOrders: 0
    },
    texts: {
      bookNow: '\u7acb\u5373\u9884\u7ea6',
      addressPrefix: '\u5e97\u94fa\u5730\u5740',
      businessHoursPrefix: '\u8425\u4e1a\u65f6\u95f4',
      addRoom: '\u65b0\u589e\u623f\u95f4',
      bookingOrders: '\u9884\u7ea6\u8ba2\u5355',
      offlineLock: '\u7ebf\u4e0b\u9501\u53f0',
      editRoom: '\u4fee\u6539\u623f\u95f4',
      deleteRoom: '\u5220\u9664\u623f\u95f4'
    }
  },

  onLoad(options) {
    const shopId = app.resolveShopIdFromOptions({ query: options || {} });
    if (shopId) {
      app.setCurrentShopId(shopId);
    }
  },

  async onShow() {
    await withLoading('\u52a0\u8f7d\u4e2d', async () => {
      await service.bootstrap().catch(() => {});
      app.refreshRole();
      if (app.globalData.userRole === 'merchant') {
        await this.loadMerchantHome();
        return;
      }
      await this.loadUserHome();
      if (!app.isUserAuthorized()) {
        this.promptUserLogin();
      }
    });
  },

  async loadUserHome() {
    const shopId = app.globalData.currentShopId;
    const { shop, roomList } = await service.getUserHomeData(shopId);
    if (shop) {
      await service.recordShopVisit(shop.id, 'browse').catch(() => {});
    }
    this.setData({
      isMerchant: false,
      shopInfo: shop ? { ...shop, businessStatus: getShopBusinessStatus(shop) } : null,
      roomList
    });
  },

  async loadMerchantHome() {
    const merchant = store.getCurrentMerchant();
    if (!merchant) {
      app.setRole('user');
      wx.reLaunch({ url: '/pages/welcome/index' });
      return;
    }
    app.setCurrentShopId(merchant.shopId);
    const dashboard = await service.getMerchantDashboard(merchant.shopId);
    this.setData({
      isMerchant: true,
      shopInfo: dashboard.shop ? {
        ...dashboard.shop,
        businessStatus: getShopBusinessStatus(dashboard.shop)
      } : null,
      stats: dashboard.stats,
      roomList: dashboard.roomList
    });
  },

  navigateToBooking(e) {
    const roomId = e.currentTarget.dataset.id;
    if (!app.isUserAuthorized()) {
      this.promptUserLogin();
      return;
    }
    withLoading('\u52a0\u8f7d\u4e2d', async () => {
      wx.navigateTo({
        url: `/pages/booking/index?roomId=${roomId}`
      });
    });
  },

  navigateTo(e) {
    withLoading('\u52a0\u8f7d\u4e2d', async () => {
      wx.navigateTo({
        url: e.currentTarget.dataset.url
      });
    });
  },

  openRoomEdit(e) {
    withLoading('\u52a0\u8f7d\u4e2d', async () => {
      wx.navigateTo({
        url: `/pages/merchant/room-edit/index?roomId=${e.currentTarget.dataset.id}`
      });
    });
  },

  openLockPage(e) {
    withLoading('\u52a0\u8f7d\u4e2d', async () => {
      wx.navigateTo({
        url: `/pages/merchant/lock-create/index?roomId=${e.currentTarget.dataset.id}`
      });
    });
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
        const result = await withLoading('\u52a0\u8f7d\u4e2d', () => service.removeRoom(roomId, this.data.shopInfo.id));
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' });
          return;
        }
        wx.showToast({ title: '\u623f\u95f4\u5df2\u5220\u9664', icon: 'success' });
        await service.bootstrap().catch(() => {});
        this.loadMerchantHome();
      }
    });
  },

  promptUserLogin() {
    if (this.loginPromptVisible) {
      return;
    }
    this.loginPromptVisible = true;
    wx.showModal({
      title: '\u672a\u767b\u5f55',
      content: '\u767b\u5f55\u540e\u5373\u53ef\u4f7f\u7528\u9884\u7ea6\u5168\u90e8\u529f\u80fd',
      confirmText: '\u53bb\u767b\u5f55',
      cancelText: '\u7a0d\u540e\u518d\u8bf4',
      success: ({ confirm }) => {
        this.loginPromptVisible = false;
        if (!confirm) {
          return;
        }
        wx.switchTab({
          url: '/pages/profile/index'
        });
      },
      fail: () => {
        this.loginPromptVisible = false;
      }
    });
  }
});
