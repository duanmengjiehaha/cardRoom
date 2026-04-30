const app = getApp();
const mock = require('../../utils/mock');
const service = require('../../utils/service');
const store = require('../../utils/store');
const { withLoading } = require('../../utils/loading');

function isDefaultNickName(nickName) {
  const value = String(nickName || '').trim();
  return !value || value === '微信用户';
}

Page({
  data: {
    isMerchant: false,
    userInfo: mock.getUserProfile(),
    logged: false,
    isAuthorized: false,
    merchantInfo: null,
    shopInfo: null,
    editVisible: false,
    editField: '',
    editTitle: '',
    editValue: '',
    hoursVisible: false,
    qrVisible: false,
    qrData: null,
    hoursRange: {
      open: '09:00',
      close: '23:30'
    },
    popupInputPlaceholder: '请输入内容',
    popupCancelText: '取消',
    popupConfirmText: '保存',
    popupCloseText: '关闭',
    popupSaveText: '保存到相册',
    texts: {
      nicknamePlaceholder: '点击输入昵称',
      ordersTitle: '我的订单',
      historyTitle: '历史商家',
      switchRole: '切换到商家版',
      pageTitle: '店铺信息管理',
      pageTip: '点击项目可修改信息',
      shopNameLabel: '店铺名称',
      addressLabel: '店铺地址',
      phoneLabel: '联系电话',
      hoursLabel: '营业时间',
      serviceInfoLabel: '入驻服务说明',
      serviceInfoValue: '200 元 / 年，免费试用 3 个月',
      qrTitle: '我的店铺二维码',
      qrDesc: '点击查看并下载',
      noticeLine1: '商家入驻小程序请联系',
      noticeLine2: '15766678745',
      merchantLogout: '退出商家登录'
    }
  },

  async onShow() {
    await withLoading('加载中', async () => {
      await service.bootstrap().catch(() => {});
      app.refreshRole();
      if (app.globalData.userRole === 'merchant') {
        await this.loadMerchantProfile();
        return;
      }
      this.loadUserProfile();
    });
  },

  loadUserProfile() {
    const userInfo = mock.getUserProfile();
    const logged = app.isUserAuthorized() && !isDefaultNickName(userInfo.nickName);
    this.setData({
      isMerchant: false,
      userInfo,
      logged,
      isAuthorized: app.isUserAuthorized()
    });
  },

  async loadMerchantProfile() {
    const merchant = store.getCurrentMerchant();
    if (!merchant) {
      app.setRole('user');
      wx.reLaunch({ url: '/pages/welcome/index' });
      return;
    }
    app.setCurrentShopId(merchant.shopId);
    const result = await service.getMerchantProfileData(merchant.shopId, merchant.id);
    const shopInfo = result.shop;
    const merchantInfo = result.merchant || merchant;
    if (!shopInfo) {
      wx.showToast({ title: '店铺信息加载失败', icon: 'none' });
      return;
    }
    this.setData({
      isMerchant: true,
      merchantInfo,
      shopInfo,
      hoursRange: {
        open: shopInfo.hours.open,
        close: shopInfo.hours.close
      }
    });
  },

  async handleChooseAvatar(e) {
    const avatarUrl = e.detail && e.detail.avatarUrl;
    if (!avatarUrl) {
      wx.showToast({ title: '未获取到头像', icon: 'none' });
      return;
    }

    const avatarProfile = app.updateUserProfile({
      avatarUrl,
      authorized: false
    });
    this.setData({
      userInfo: avatarProfile,
      logged: false,
      isAuthorized: false
    });
  },

  onNicknameBlur(e) {
    const nickName = String((e.detail && e.detail.value) || '').trim();
    if (!nickName) {
      return;
    }
    const profile = app.updateUserProfile({
      nickName,
      authorized: this.canAuthorize({
        nickName,
        avatarUrl: this.data.userInfo.avatarUrl
      })
    });
    this.setData({
      userInfo: profile,
      logged: profile.authorized,
      isAuthorized: app.isUserAuthorized()
    });
    if (profile.authorized) {
      wx.showToast({ title: '登录成功', icon: 'success' });
    } else {
      wx.showToast({ title: '请先选择头像', icon: 'none' });
    }
  },

  canAuthorize({ nickName, avatarUrl }) {
    return !isDefaultNickName(nickName) && !!avatarUrl && avatarUrl !== mock.DEFAULT_AVATAR;
  },

  navigateTo(e) {
    withLoading('加载中', async () => {
      wx.navigateTo({
        url: e.currentTarget.dataset.url
      });
    });
  },

  switchRole() {
    wx.showModal({
      title: '切换到商家版',
      content: '确认切换到商家版吗？',
      success: ({ confirm }) => {
        if (!confirm) {
          return;
        }
        withLoading('加载中', async () => {
          wx.reLaunch({
            url: '/pages/welcome/index?manual=1'
          });
        });
      }
    });
  },

  openEdit(e) {
    const { field } = e.currentTarget.dataset;
    const { shopInfo, merchantInfo, texts } = this.data;
    if (!shopInfo || !merchantInfo) {
      return;
    }
    if (field === 'hours') {
      this.setData({
        hoursVisible: true,
        hoursRange: {
          open: shopInfo.hours.open,
          close: shopInfo.hours.close
        }
      });
      return;
    }
    const config = {
      name: { title: texts.shopNameLabel, value: shopInfo.name || '' },
      address: { title: texts.addressLabel, value: shopInfo.address || '' },
      phone: { title: texts.phoneLabel, value: merchantInfo.phone || '' }
    }[field];
    if (!config) {
      return;
    }
    this.setData({
      editVisible: true,
      editField: field,
      editTitle: config.title,
      editValue: config.value
    });
  },

  closeEdit() {
    this.setData({
      editVisible: false,
      editField: '',
      editTitle: '',
      editValue: ''
    });
  },

  closeHoursPopup() {
    this.setData({
      hoursVisible: false
    });
  },

  closeQrPopup() {
    this.setData({
      qrVisible: false
    });
  },

  handleEditInput(e) {
    this.setData({
      editValue: e.detail.value
    });
  },

  handleHoursChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`hoursRange.${field}`]: e.detail.value
    });
  },

  async saveHoursRange() {
    const { shopInfo, merchantInfo, hoursRange } = this.data;
    if (!shopInfo || !merchantInfo) {
      return;
    }
    await this.submitMerchantProfile({
      shopId: shopInfo.id,
      merchantId: merchantInfo.id,
      hours: {
        open: hoursRange.open,
        close: hoursRange.close
      }
    });
    this.closeHoursPopup();
  },

  async submitMerchantProfile(payload) {
    const { merchantInfo, shopInfo } = this.data;
    const result = await withLoading('保存中', () => service.updateMerchantProfile(payload));
    if (!result.ok) {
      wx.showToast({ title: result.message || '保存失败', icon: 'none' });
      return false;
    }
    if (result.merchant) {
      store.setCurrentMerchant(result.merchant);
    }
    this.setData({
      merchantInfo: result.merchant || merchantInfo,
      shopInfo: result.shop || shopInfo,
      hoursRange: {
        open: (result.shop || shopInfo).hours.open,
        close: (result.shop || shopInfo).hours.close
      }
    });
    wx.showToast({ title: '保存成功', icon: 'success' });
    return true;
  },

  async saveEdit() {
    const { editField, editValue, shopInfo, merchantInfo } = this.data;
    const value = String(editValue || '').trim();
    if (!value || !shopInfo || !merchantInfo) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }

    const payload = {
      shopId: shopInfo.id,
      merchantId: merchantInfo.id
    };

    if (editField === 'name') {
      payload.name = value;
    } else if (editField === 'address') {
      payload.address = value;
    } else if (editField === 'phone') {
      if (!/^1[3-9]\d{9}$/.test(value)) {
        wx.showToast({ title: '请输入正确手机号', icon: 'none' });
        return;
      }
      payload.phone = value;
    } else if (editField === 'hours') {
      const parts = value.split('-').map((item) => item.trim());
      if (parts.length !== 2 || !/^\d{2}:\d{2}$/.test(parts[0]) || !/^\d{2}:\d{2}$/.test(parts[1])) {
        wx.showToast({ title: '请按 08:00-23:30 格式输入', icon: 'none' });
        return;
      }
      payload.hours = {
        open: parts[0],
        close: parts[1]
      };
    }

    const ok = await this.submitMerchantProfile(payload);
    if (!ok) {
      return;
    }
    this.closeEdit();
  },

  async openQrCard() {
    const { shopInfo } = this.data;
    if (!shopInfo) {
      return;
    }
    const result = await withLoading('生成中', () => service.getShopQrCode(shopInfo.id));
    if (!result.ok) {
      wx.showModal({
        title: '二维码获取失败',
        content: result.message || result.errMsg || '请查看云函数日志排查具体原因',
        showCancel: false
      });
      return;
    }
    this.setData({
      qrVisible: true,
      qrData: result
    });
  },

  async saveQrCode() {
    const { qrData } = this.data;
    if (!qrData || !qrData.fileID) {
      wx.showToast({ title: '二维码不存在', icon: 'none' });
      return;
    }
    try {
      const download = await wx.cloud.downloadFile({
        fileID: qrData.fileID
      });
      await wx.saveImageToPhotosAlbum({
        filePath: download.tempFilePath
      });
      wx.showToast({ title: '已保存到相册', icon: 'success' });
    } catch (error) {
      const message = error && error.errMsg ? error.errMsg : '';
      if (message.includes('auth deny') || message.includes('authorize')) {
        wx.showModal({
          title: '保存失败',
          content: '请先允许保存到相册权限后再重试',
          success: ({ confirm }) => {
            if (confirm) {
              wx.openSetting({});
            }
          }
        });
        return;
      }
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  logout() {
    wx.showModal({
      title: '退出商家登录',
      content: '确认退出商家后台并返回身份选择页吗？',
      success: ({ confirm }) => {
        if (!confirm) {
          return;
        }
        withLoading('退出中', async () => {
          store.clearMerchantSession();
          app.setRole('user');
          wx.reLaunch({
            url: '/pages/welcome/index?manual=1'
          });
        });
      }
    });
  }
});
