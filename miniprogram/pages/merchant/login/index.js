// pages/merchant/login/index.js
Page({
  data: {
    account: '',
    password: ''
  },

  login() {
    const { account, password } = this.data;
    // 硬编码的测试账号
    if (account === 'admin' && password === '123456') {
      wx.showToast({
        title: '登录成功',
        icon: 'success'
      });
      // 跳转到商家工作台
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/merchant/dashboard/index'
        });
      }, 1500);
    } else {
      wx.showToast({
        title: '账号或密码错误',
        icon: 'none'
      });
    }
  }
});
