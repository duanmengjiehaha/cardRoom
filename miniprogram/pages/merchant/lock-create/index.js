const app = getApp();
const service = require('../../../utils/service');
const store = require('../../../utils/store');
const { withLoading } = require('../../../utils/loading');

function pad(num) {
  return String(num).padStart(2, '0');
}

function todayLabel() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function currentTimeText() {
  const date = new Date();
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function plusMinutes(timeText, minutesToAdd) {
  const [hours, minutes] = String(timeText || '00:00').split(':').map(Number);
  const totalMinutes = ((hours || 0) * 60) + (minutes || 0) + minutesToAdd;
  const safeMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const nextHours = Math.floor(safeMinutes / 60);
  const nextMinutes = safeMinutes % 60;
  return `${pad(nextHours)}:${pad(nextMinutes)}`;
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
    isLoading: true,
    roomInfo: null,
    shopInfo: null,
    bookingDay: todayLabel(),
    timeSlots: [],
    customerName: '',
    phone: '',
    startTime: '',
    endTime: '',
    texts: {
      occupiedTitle: '\u5df2\u5360\u7528\u65f6\u6bb5',
      occupiedTag: '\u5360\u7528\u9884\u89c8',
      slotDesc: '\u7ea2\u8272\u4e3a\u5df2\u88ab\u9884\u7ea6\u6216\u5df2\u9501\u5b9a\u7684\u65f6\u6bb5\uff0c\u7070\u8272\u4e3a\u5df2\u8fc7\u53bb\u65f6\u6bb5\u3002',
      customerLabel: '\u5ba2\u6237',
      customerPlaceholder: '\u9009\u586b',
      phoneLabel: '\u7535\u8bdd',
      phonePlaceholder: '\u9009\u586b',
      start: '\u5f00\u59cb\u65f6\u95f4',
      end: '\u7ed3\u675f\u65f6\u95f4',
      selectStart: '\u9009\u62e9\u5f00\u59cb\u65f6\u95f4',
      selectEnd: '\u9009\u62e9\u7ed3\u675f\u65f6\u95f4',
      cancel: '\u53d6\u6d88',
      confirmLock: '\u786e\u8ba4\u9501\u53f0'
    }
  },

  async onLoad(options) {
    this.roomId = options.roomId || '';
    const startTime = currentTimeText();
    this.setData({
      startTime,
      endTime: plusMinutes(startTime, 60)
    });
    await this.loadPage();
  },

  async loadPage() {
    this.setData({ isLoading: true });
    await withLoading('\u52a0\u8f7d\u4e2d', async () => {
      await service.bootstrap().catch(() => {});
      const merchant = store.getCurrentMerchant();
      if (!merchant) {
        wx.redirectTo({ url: '/pages/merchant/login/index' });
        return;
      }

      app.setRole('merchant');
      app.setCurrentShopId(merchant.shopId);
      const { room: roomInfo, shop: shopInfo } = await service.getRoomContext(this.roomId);
      if (!roomInfo) {
        wx.showToast({ title: '\u623f\u95f4\u4e0d\u5b58\u5728', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 700);
        return;
      }
      const timeSlots = await service.getBookingSlots(roomInfo.shopId, roomInfo.id, this.data.bookingDay);
      this.setData({
        roomInfo,
        shopInfo,
        timeSlots,
        isLoading: false
      });
    });
  },

  handleFieldChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [field]: getFieldValue(e.detail)
    });
  },

  handleStartChange(e) {
    const startTime = e.detail.value;
    this.setData({
      startTime,
      endTime: this.data.endTime || plusMinutes(startTime, 60)
    });
  },

  handleEndChange(e) {
    this.setData({
      endTime: e.detail.value
    });
  },

  goBack() {
    withLoading('\u8fd4\u56de\u4e2d', async () => {
      wx.navigateBack();
    });
  },

  async submitLock() {
    const { roomInfo, shopInfo, customerName, phone, startTime, endTime, bookingDay } = this.data;
    if (!startTime) {
      wx.showToast({ title: '\u8bf7\u9009\u62e9\u5f00\u59cb\u65f6\u95f4', icon: 'none' });
      return;
    }
    if (!endTime) {
      wx.showToast({ title: '\u8bf7\u9009\u62e9\u7ed3\u675f\u65f6\u95f4', icon: 'none' });
      return;
    }

    let startAt = new Date(`${bookingDay}T${startTime}:00`).getTime();
    let endAt = new Date(`${bookingDay}T${endTime}:00`).getTime();
    if (endAt <= startAt) {
      endAt += 24 * 60 * 60 * 1000;
    }

    const result = await withLoading('\u63d0\u4ea4\u4e2d', () => service.createOfflineLock({
      shopId: shopInfo.id,
      roomId: roomInfo.id,
      customerName: customerName.trim(),
      phone: phone.trim(),
      startAt,
      endAt
    }));

    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' });
      return;
    }

    wx.showToast({ title: '\u9501\u53f0\u6210\u529f', icon: 'success' });
    setTimeout(() => {
      wx.navigateBack();
    }, 700);
  }
});
