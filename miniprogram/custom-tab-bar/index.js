const app = getApp();

const USER_TABS = [
  {
    pagePath: '/pages/home/index',
    text: '首页',
    iconPath: '/images/tab_home.png',
    selectedIconPath: '/images/tab_home_active.png'
  },
  {
    pagePath: '/pages/profile/index',
    text: '我的',
    iconPath: '/images/tab_profile.png',
    selectedIconPath: '/images/tab_profile_active.png'
  }
];

const MERCHANT_TABS = [
  {
    pagePath: '/pages/home/index',
    text: '工作台',
    iconPath: '/images/tab_home.png',
    selectedIconPath: '/images/tab_home_active.png'
  },
  {
    pagePath: '/pages/profile/index',
    text: '店铺',
    iconPath: '/images/tab_profile.png',
    selectedIconPath: '/images/tab_profile_active.png'
  }
];

Component({
  data: {
    selected: 0,
    color: '#8b9bb0',
    selectedColor: '#4A90E2',
    list: USER_TABS
  },

  methods: {
    init() {
      const role = app.globalData.userRole;
      const list = role === 'merchant' ? MERCHANT_TABS : USER_TABS;
      const pages = getCurrentPages();
      const currentRoute = pages.length ? `/${pages[pages.length - 1].route}` : list[0].pagePath;
      const selected = Math.max(list.findIndex((item) => item.pagePath === currentRoute), 0);
      this.setData({ list, selected });
    },

    switchTab(e) {
      const { path, index } = e.currentTarget.dataset;
      wx.switchTab({ url: path });
      this.setData({ selected: index });
    }
  },

  lifetimes: {
    attached() {
      this.init();
    }
  },

  pageLifetimes: {
    show() {
      this.init();
    }
  }
});
