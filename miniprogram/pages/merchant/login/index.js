const service = require('../../../utils/service');
const { withLoading } = require('../../../utils/loading');

Page({
  data: {
    account: '',
    password: ''
  },

  handleInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [field]: e.detail.value });
  },

  async login() {
    const { account, password } = this.data;
    if (!account.trim() || !password.trim()) {
      wx.showToast({ title: '\u8bf7\u8f93\u5165\u8d26\u53f7\u548c\u5bc6\u7801', icon: 'none' });
      return;
    }

    const merchant = await withLoading('\u767b\u5f55\u4e2d', async () => service.loginMerchant(account.trim(), password.trim()));
    if (!merchant) {
      wx.showToast({ title: '\u8d26\u53f7\u3001\u5bc6\u7801\u6216\u8d26\u53f7\u72b6\u6001\u4e0d\u53ef\u7528', icon: 'none' });
      return;
    }

    wx.showToast({ title: '\u767b\u5f55\u6210\u529f', icon: 'success' });
    setTimeout(() => {
      wx.reLaunch({
        url: '/pages/merchant/home/index'
      });
    }, 800);
  }
});
