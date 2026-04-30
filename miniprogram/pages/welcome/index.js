const app = getApp();
const service = require('../../utils/service');
const { withLoading } = require('../../utils/loading');

Page({
  data: {
    merchantOpen: false,
    account: '',
    password: '',
    showPassword: false,
    texts: {
      title: '\u6b22\u8fce\u4f7f\u7528\u4e50\u95f2\u9601\u68cb\u724c\u9986\u8ba2\u4f4d',
      subtitle: '\u8bf7\u9009\u62e9\u767b\u5f55\u8eab\u4efd',
      userEntry: '\u666e\u901a\u7528\u6237',
      userDesc: '\u5feb\u901f\u8fdb\u5165\u95e8\u5e97\u9996\u9875\u8fdb\u884c\u9884\u7ea6',
      merchantEntry: '\u5546\u5bb6\u767b\u5f55',
      merchantDesc: '\u70b9\u51fb\u5c55\u5f00\u5546\u5bb6\u540e\u53f0\u767b\u5f55',
      merchantTitle: '\u5546\u5bb6\u540e\u53f0\u767b\u5f55',
      accountLabel: '\u5546\u5bb6\u8d26\u53f7',
      accountPlaceholder: '\u8bf7\u8f93\u5165\u8d26\u53f7',
      passwordLabel: '\u767b\u5f55\u5bc6\u7801',
      passwordPlaceholder: '\u8bf7\u8f93\u5165\u5bc6\u7801',
      login: '\u767b\u5f55\u5de5\u4f5c\u53f0',
      demo: '\u793a\u4f8b\u8d26\u53f7\uff1ashopa / 123456',
      footer: '\u591a\u5546\u5bb6\u7edf\u4e00\u5165\u9a7b\u7ba1\u7406\u5e73\u53f0'
    }
  },

  onLoad() {
    wx.hideHomeButton();
  },

  handleInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [field]: e.detail.value });
  },

  chooseUser() {
    app.setRole('user');
    withLoading('\u8df3\u8f6c\u4e2d', async () => {
      wx.switchTab({
        url: '/pages/home/index'
      });
    });
  },

  toggleMerchant() {
    this.setData({
      merchantOpen: !this.data.merchantOpen
    });
  },

  togglePassword() {
    this.setData({
      showPassword: !this.data.showPassword
    });
  },

  async loginMerchant() {
    const { account, password } = this.data;
    if (!account.trim() || !password.trim()) {
      wx.showToast({ title: '\u8bf7\u8f93\u5165\u8d26\u53f7\u548c\u5bc6\u7801', icon: 'none' });
      return;
    }

    const merchant = await withLoading('\u767b\u5f55\u4e2d', () => service.loginMerchant(account.trim(), password.trim()));
    if (!merchant) {
      wx.showToast({ title: '\u8d26\u53f7\u6216\u5bc6\u7801\u9519\u8bef', icon: 'none' });
      return;
    }

    app.setRole('merchant');
    wx.showToast({ title: '\u767b\u5f55\u6210\u529f', icon: 'success' });
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/home/index'
      });
    }, 700);
  }
});
