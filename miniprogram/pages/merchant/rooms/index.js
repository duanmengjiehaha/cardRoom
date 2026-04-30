const app = getApp();
const store = require('../../../utils/store');
const service = require('../../../utils/service');
const { withLoading } = require('../../../utils/loading');

function pad(value) {
  return String(value).padStart(2, '0');
}

function todayLabel() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function buildTimestamp(dayLabel, time) {
  const [year, month, day] = String(dayLabel).split('-').map(Number);
  const [hours, minutes] = String(time || '00:00').split(':').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0, 0).getTime();
}

Page({
  data: {
    shopInfo: null,
    roomList: [],
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
    await withLoading('加载中', async () => {
      await service.bootstrap().catch(() => {});
      const merchant = store.getCurrentMerchant();
      if (!merchant) {
        wx.redirectTo({ url: '/pages/merchant/login/index' });
        return;
      }
      app.setRole('merchant');
      app.setCurrentShopId(merchant.shopId);
      await this.loadPage(merchant.shopId);
    });
  },

  async loadPage(shopId) {
    const dashboard = await service.getMerchantDashboard(shopId);
    this.setData({
      shopInfo: dashboard.shop || null,
      roomList: dashboard.roomList || []
    });
  },

  goCreatePage() {
    withLoading('加载中', async () => {
      wx.navigateTo({
        url: '/pages/merchant/room-create/index'
      });
    });
  },

  goEditPage(e) {
    withLoading('加载中', async () => {
      wx.navigateTo({
        url: `/pages/merchant/room-edit/index?roomId=${e.currentTarget.dataset.id}`
      });
    });
  },

  deleteRoom(e) {
    const roomId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除房间',
      content: '删除后不可恢复，确认继续吗？',
      success: async ({ confirm }) => {
        if (!confirm) {
          return;
        }
        const shopId = this.data.shopInfo && this.data.shopInfo.id;
        if (!shopId) {
          wx.showToast({ title: '店铺信息异常', icon: 'none' });
          return;
        }
        const result = await withLoading('处理中', () => service.removeRoom(roomId, shopId));
        if (!result.ok) {
          wx.showToast({ title: result.message || '删除失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: '房间已删除', icon: 'success' });
        await this.loadPage(shopId);
      }
    });
  },

  openLockModal(e) {
    const room = this.data.roomList.find((item) => item.id === e.currentTarget.dataset.id);
    this.setData({
      showLockModal: true,
      lockRoomId: e.currentTarget.dataset.id,
      lockRoomName: room ? room.displayName : '',
      lockForm: {
        customerName: '',
        phone: '',
        startTime: '14:00',
        endTime: '15:00'
      }
    });
  },

  hideLockModal() {
    this.setData({ showLockModal: false });
  },

  handleLockInput(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail && typeof e.detail.value !== 'undefined' ? e.detail.value : '';
    this.setData({
      [`lockForm.${field}`]: value
    });
  },

  async submitLock() {
    const { lockForm, lockRoomId, shopInfo } = this.data;
    if (!lockRoomId || !shopInfo) {
      return;
    }

    let startAt = buildTimestamp(todayLabel(), lockForm.startTime);
    let endAt = buildTimestamp(todayLabel(), lockForm.endTime);
    if (endAt <= startAt) {
      endAt += 24 * 60 * 60 * 1000;
    }

    const result = await withLoading('锁台中', () => service.createOfflineLock({
      shopId: shopInfo.id,
      roomId: lockRoomId,
      customerName: String(lockForm.customerName || '').trim(),
      phone: String(lockForm.phone || '').trim(),
      startAt,
      endAt
    }));

    if (!result.ok) {
      wx.showToast({ title: result.message || '锁台失败', icon: 'none' });
      return;
    }

    wx.showToast({ title: '锁台成功', icon: 'success' });
    this.hideLockModal();
    await this.loadPage(shopInfo.id);
  }
});
