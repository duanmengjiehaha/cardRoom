const mock = require('./utils/mock');
const store = require('./utils/store');
const cloudService = require('./utils/cloud');
const service = require('./utils/service');

App({
  onLaunch(options) {
    const cloud = cloudService.initCloud();
    mock.ensureSeedData();
    this.refreshRole();
    this.globalData.userProfile = mock.getUserProfile();
    this.globalData.cloudEnabled = cloud.enabled;
    this.globalData.cloudEnvId = cloud.envId;
    this.applyLaunchShop(options);
    service.bootstrap().catch(() => {});
  },

  onShow(options) {
    this.applyLaunchShop(options);
  },

  refreshRole() {
    this.globalData.userRole = store.getRole() || 'user';
    this.globalData.currentShopId = store.getCurrentShopId();
  },

  setRole(role) {
    store.setRole(role);
    this.refreshRole();
  },

  setCurrentShopId(shopId) {
    store.setCurrentShopId(shopId);
    this.refreshRole();
  },

  applyLaunchShop(options) {
    const shopId = this.resolveShopIdFromOptions(options);
    if (shopId) {
      this.setCurrentShopId(shopId);
    }
  },

  resolveShopIdFromOptions(options = {}) {
    const query = options.query || {};
    if (query.shopId) {
      return query.shopId;
    }
    if (!query.scene) {
      return '';
    }
    const scene = decodeURIComponent(query.scene);
    const pairs = scene.replace(/;/g, '&').split('&');
    for (let i = 0; i < pairs.length; i += 1) {
      const [key, value] = pairs[i].split('=');
      if (key === 'sid') {
        return value || '';
      }
    }
    return '';
  },

  updateUserProfile(profile) {
    this.globalData.userProfile = store.saveUserProfile(profile, {
      nickName: '微信用户',
      avatarUrl: mock.DEFAULT_AVATAR,
      phone: '',
      authorized: false
    });
    return this.globalData.userProfile;
  },

  isUserAuthorized() {
    const profile = this.globalData.userProfile || mock.getUserProfile();
    return !!(profile && profile.authorized);
  },

  globalData: {
    userRole: 'user',
    currentShopId: 'shop-a',
    userProfile: null,
    cloudEnabled: false,
    cloudEnvId: ''
  }
});
