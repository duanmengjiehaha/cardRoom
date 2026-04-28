// pages/profile/index.js
Page({
  data: {
    userInfo: {
      avatarUrl: 'https://core-normal.traeapi.us/api/ide/v1/text_to_image?prompt=A%20simple%2C%20flat%20design%20avatar%20of%20a%20person%27s%20face.%20The%20avatar%20should%20be%20gender-neutral%2C%20with%20a%20pleasant%2C%20welcoming%20expression.%20Use%20a%20limited%20color%20palette%20of%20soft%2C%20muted%20tones.%20The%20background%20should%20be%20a%20solid%2C%20light%20color.&image_size=square',
      nickName: '微信用户'
    },
    canIUseGetUserProfile: false,
  },

  onLoad() {
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      })
    }
  },

  getUserProfile(e) {
    wx.getUserProfile({
      desc: '用于完善会员资料',
      success: (res) => {
        this.setData({
          userInfo: res.userInfo,
        })
      }
    })
  },

  navigateTo(e) {
    const page = e.currentTarget.dataset.page;
    wx.navigateTo({
      url: `/pages/${page}/index`
    });
  }
});