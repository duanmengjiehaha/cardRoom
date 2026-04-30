const app = getApp();
const store = require('../../../utils/store');
const service = require('../../../utils/service');
const { withLoading } = require('../../../utils/loading');

const DEFAULT_ROOM_IMAGE = '/images/default-goods-image.png';

function getFieldValue(detail) {
  if (typeof detail === 'string') {
    return detail;
  }
  if (detail && typeof detail.value !== 'undefined') {
    return detail.value;
  }
  return '';
}

function normalizePriceLabel(priceLabel) {
  return String(priceLabel || '').replace(/^参考价[:：]?\s*/, '').trim();
}

Page({
  data: {
    roomForm: {
      name: '',
      tableNo: '',
      priceLabel: '',
      image: DEFAULT_ROOM_IMAGE
    },
    texts: {
      roomName: '房间名',
      roomNamePlaceholder: '填写房间名称',
      roomNo: '房间号',
      roomNoPlaceholder: '例如 A101',
      price: '参考价',
      pricePlaceholder: '例如 88元/小时',
      imageTip: '非必填，未选择图片将按默认图片展示',
      save: '保存'
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
    });
  },

  handleFieldChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`roomForm.${field}`]: getFieldValue(e.detail)
    });
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file) {
          return;
        }
        this.setData({
          'roomForm.image': file.tempFilePath
        });
      }
    });
  },

  async saveRoom() {
    const merchant = store.getCurrentMerchant();
    const { roomForm } = this.data;
    if (!merchant) {
      wx.showToast({ title: '商家登录已失效', icon: 'none' });
      return;
    }
    if (!roomForm.name.trim() || !roomForm.tableNo.trim() || !roomForm.priceLabel.trim()) {
      wx.showToast({ title: '请完整填写信息', icon: 'none' });
      return;
    }
    const result = await withLoading('保存中', () => service.saveRoom({
      shopId: merchant.shopId,
      name: roomForm.name.trim(),
      tableNo: roomForm.tableNo.trim(),
      priceLabel: normalizePriceLabel(roomForm.priceLabel),
      image: roomForm.image || DEFAULT_ROOM_IMAGE
    }));
    if (!result.ok) {
      wx.showToast({ title: result.message || '保存失败', icon: 'none' });
      return;
    }
    wx.showToast({ title: '房间已新增', icon: 'success' });
    setTimeout(() => {
      wx.navigateBack();
    }, 700);
  }
});
