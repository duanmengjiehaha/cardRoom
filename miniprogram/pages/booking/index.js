const app = getApp();
const service = require('../../utils/service');
const cloudService = require('../../utils/cloud');
const store = require('../../utils/store');
const { withLoading } = require('../../utils/loading');

function dayLabel() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const DEFAULT_SELECTED_TEXT = '\u8bf7\u9009\u62e9\u8fde\u7eed\u7684\u534a\u5c0f\u65f6\u65f6\u6bb5';

function getFieldValue(detail) {
  if (typeof detail === 'string') {
    return detail;
  }
  if (detail && typeof detail.value !== 'undefined') {
    return detail.value;
  }
  return '';
}

function formatMinute(totalMinutes) {
  const safeMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function confirmModal(options) {
  return new Promise((resolve) => {
    wx.showModal({
      ...options,
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false)
    });
  });
}

Page({
  data: {
    isLoading: true,
    shopInfo: null,
    roomInfo: null,
    bookingDay: dayLabel(),
    timeSlots: [],
    selectedIndexes: [],
    selectedText: DEFAULT_SELECTED_TEXT,
    name: '',
    phone: '',
    phoneAuthDisabled: false,
    texts: {
      arrivalReminder: '\u5230\u5e97\u63d0\u9192',
      businessHours: '\u8425\u4e1a\u65f6\u95f4',
      slotTitle: '\u9009\u62e9\u9884\u7ea6\u65f6\u6bb5',
      opening: '\u8425\u4e1a\u4e2d',
      slotDesc: '\u4ec5\u5c55\u793a\u8425\u4e1a\u65f6\u95f4\u5185\u65f6\u6bb5\uff0c\u5f53\u524d\u65f6\u95f4\u4e4b\u524d\u7684\u65f6\u6bb5\u4e0d\u53ef\u9009\u62e9\uff0c\u7ea2\u8272\u4e3a\u5df2\u5360\u7528\u3002',
      userLabel: '\u9884\u7ea6\u4eba',
      userPlaceholder: '\u586b\u5199\u59d3\u540d',
      phoneLabel: '\u624b\u673a\u53f7',
      phonePlaceholder: '\u586b\u5199\u624b\u673a\u53f7',
      phoneTip: '\u70b9\u51fb\u624b\u673a\u53f7\u8f93\u5165\u6846\u4f18\u5148\u5524\u8d77\u5fae\u4fe1\u6388\u6743\uff0c\u4e0d\u540c\u610f\u65f6\u4ecd\u53ef\u624b\u52a8\u586b\u5199',
      submit: '\u786e\u8ba4\u9884\u7ea6'
    }
  },

  async onLoad(options) {
    this.setData({ isLoading: true });
    await withLoading('\u52a0\u8f7d\u4e2d', async () => {
      await service.bootstrap().catch(() => {});
      const { room: roomInfo, shop: shopInfo } = await service.getRoomContext(options.roomId);
      if (!roomInfo) {
        wx.showToast({ title: '\u623f\u95f4\u4e0d\u5b58\u5728', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 800);
        return;
      }

      app.setCurrentShopId(roomInfo.shopId);
      const profile = store.getUserProfile({
        nickName: '微信用户',
        avatarUrl: '/images/avatar.png',
        phone: '',
        authorized: false
      }) || {};

      this.setData({
        roomInfo,
        shopInfo,
        name: profile.authorized ? profile.nickName : '',
        phone: profile.phone || '',
        phoneAuthDisabled: !!profile.phone
      });

      await this.refreshSlots();
      this.setData({ isLoading: false });
    });
  },

  async refreshSlots() {
    const { bookingDay, roomInfo } = this.data;
    const timeSlots = await service.getBookingSlots(roomInfo.shopId, roomInfo.id, bookingDay);
    this.setData({
      timeSlots,
      selectedIndexes: [],
      selectedText: DEFAULT_SELECTED_TEXT
    });
  },

  selectSlot(e) {
    const index = e.currentTarget.dataset.index;
    const slot = this.data.timeSlots[index];
    if (!slot || !['available', 'selected'].includes(slot.status)) {
      return;
    }

    const selectedIndexes = [...this.data.selectedIndexes].sort((a, b) => a - b);
    let nextIndexes = [];

    if (!selectedIndexes.length) {
      nextIndexes = [index];
    } else {
      const first = selectedIndexes[0];
      const last = selectedIndexes[selectedIndexes.length - 1];

      if (selectedIndexes.length === 1 && first === index) {
        nextIndexes = [];
      } else if (index < first) {
        nextIndexes = this.buildRange(index, last);
      } else if (index > last) {
        nextIndexes = this.buildRange(first, index);
      } else if (index === first) {
        nextIndexes = selectedIndexes.slice(1);
      } else if (index === last) {
        nextIndexes = selectedIndexes.slice(0, -1);
      } else {
        nextIndexes = [index];
      }
    }

    if (!this.isRangeSelectable(nextIndexes)) {
      wx.showToast({ title: '\u53ea\u80fd\u9009\u62e9\u8fde\u7eed\u4e14\u672a\u88ab\u5360\u7528\u7684\u65f6\u6bb5', icon: 'none' });
      return;
    }

    this.setSelection(nextIndexes);
  },

  buildRange(start, end) {
    const result = [];
    for (let i = start; i <= end; i += 1) {
      result.push(i);
    }
    return result;
  },

  isRangeSelectable(indexes) {
    return indexes.every((index) => {
      const status = this.data.timeSlots[index] && this.data.timeSlots[index].status;
      return status === 'available' || status === 'selected';
    });
  },

  setSelection(indexes) {
    const timeSlots = this.data.timeSlots.map((slot) => {
      if (slot.status === 'selected') {
        return { ...slot, status: 'available' };
      }
      return slot;
    });

    indexes.forEach((index) => {
      timeSlots[index].status = 'selected';
    });

    let selectedText = DEFAULT_SELECTED_TEXT;
    if (indexes.length) {
      const start = timeSlots[indexes[0]].time;
      const endSlot = timeSlots[indexes[indexes.length - 1]];
      selectedText = `${start} - ${formatMinute(endSlot.endMinute)}\uff0c\u5171 ${indexes.length * 0.5} \u5c0f\u65f6`;
    }

    this.setData({
      timeSlots,
      selectedIndexes: indexes,
      selectedText
    });
  },

  handleFieldChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [field]: getFieldValue(e.detail) });
  },

  async handleGetPhoneNumber(e) {
    const detail = e.detail || {};
    if (detail.errMsg && detail.errMsg.indexOf(':ok') === -1) {
      this.setData({
        phoneAuthDisabled: true
      });
      wx.showToast({
        title: '\u5df2\u53d6\u6d88\u6388\u6743\uff0c\u53ef\u76f4\u63a5\u624b\u52a8\u8f93\u5165',
        icon: 'none'
      });
      return;
    }

    const code = detail.code;
    if (!code) {
      wx.showToast({
        title: '\u672a\u83b7\u53d6\u5230\u624b\u673a\u53f7\u6388\u6743\u4fe1\u606f',
        icon: 'none'
      });
      return;
    }

    if (!cloudService.canUseCloud()) {
      wx.showToast({
        title: '\u8bf7\u5148\u914d\u7f6e\u4e91\u73af\u5883\u540e\u518d\u83b7\u53d6',
        icon: 'none'
      });
      return;
    }

    try {
      const result = await withLoading('\u83b7\u53d6\u4e2d', () => service.getWechatPhoneNumber(code));
      if (!result.ok || !result.phoneNumber) {
        wx.showToast({
          title: result.message || '\u83b7\u53d6\u624b\u673a\u53f7\u5931\u8d25',
          icon: 'none'
        });
        return;
      }

      this.setData({
        phone: result.phoneNumber,
        phoneAuthDisabled: true
      });
      app.updateUserProfile({ phone: result.phoneNumber });
      wx.showToast({
        title: '\u5df2\u81ea\u52a8\u56de\u586b',
        icon: 'success'
      });
    } catch (error) {
      wx.showToast({
        title: '\u83b7\u53d6\u624b\u673a\u53f7\u5931\u8d25',
        icon: 'none'
      });
    }
  },

  async submitBooking() {
    const { selectedIndexes, timeSlots, roomInfo, name, phone } = this.data;

    if (!selectedIndexes.length) {
      wx.showToast({ title: '\u8bf7\u5148\u9009\u62e9\u9884\u7ea6\u65f6\u6bb5', icon: 'none' });
      return;
    }

    if (!name.trim()) {
      wx.showToast({ title: '\u8bf7\u586b\u5199\u9884\u7ea6\u4eba\u59d3\u540d', icon: 'none' });
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '\u8bf7\u8f93\u5165\u6b63\u786e\u624b\u673a\u53f7', icon: 'none' });
      return;
    }

    const startAt = timeSlots[selectedIndexes[0]].startAt;
    const endAt = timeSlots[selectedIndexes[selectedIndexes.length - 1]].endAt;
    const startText = timeSlots[selectedIndexes[0]].time;
    const endText = formatMinute(timeSlots[selectedIndexes[selectedIndexes.length - 1]].endMinute);
    const confirmed = await confirmModal({
      title: '确认预约',
      content: `是否预约 ${startText}-${endText} 的房间呢？`,
      confirmText: '确认',
      cancelText: '取消'
    });
    if (!confirmed) {
      return;
    }
    let result;
    try {
      result = await withLoading('\u9884\u7ea6\u4e2d', () => service.createUserBooking({
        shopId: roomInfo.shopId,
        roomId: roomInfo.id,
        userName: name.trim(),
        phone,
        startAt,
        endAt
      }));
    } catch (error) {
      wx.showToast({
        title: (error && error.message) || '\u9884\u7ea6\u5931\u8d25',
        icon: 'none'
      });
      return;
    }

    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' });
      await withLoading('\u5237\u65b0\u4e2d', () => this.refreshSlots());
      return;
    }

    app.updateUserProfile({ nickName: name.trim(), phone });
    wx.showToast({ title: '\u9884\u7ea6\u6210\u529f', icon: 'success' });

    setTimeout(() => {
      wx.navigateTo({ url: '/pages/orders/index' });
    }, 900);
  }
});
