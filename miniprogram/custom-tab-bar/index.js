// custom-tab-bar/index.js
Component({
  data: {
    selected: 0,
    color: "#999999",
    selectedColor: "#409EFF",
    userList: [
      {
        pagePath: "/pages/home/index",
        text: "首页",
        iconPath: "/images/tab_home.png",
        selectedIconPath: "/images/tab_home_active.png"
      },
      {
        pagePath: "/pages/profile/index",
        text: "我的",
        iconPath: "/images/tab_profile.png",
        selectedIconPath: "/images/tab_profile_active.png"
      }
    ],
    merchantList: [
        {
          pagePath: "/pages/merchant/home/index",
          text: "首页",
          iconPath: "/images/tab_home.png",
          selectedIconPath: "/images/tab_home_active.png"
        },
        {
          pagePath: "/pages/merchant/profile/index",
          text: "我的",
          iconPath: "/images/tab_profile.png",
          selectedIconPath: "/images/tab_profile_active.png"
        }
    ]
  },
  computed: {
      list() {
          return getApp().globalData.userRole === 'merchant' ? this.data.merchantList : this.data.userList;
      }
  },
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      wx.switchTab({ url });
      this.setData({
        selected: data.index
      });
    }
  }
})
