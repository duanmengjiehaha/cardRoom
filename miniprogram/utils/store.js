const ROLE_KEY = 'card-room-role';
const CURRENT_SHOP_KEY = 'card-room-current-shop-id';
const MERCHANT_KEY = 'card-room-current-merchant';
const USER_PROFILE_KEY = 'card-room-user-profile';
const USER_ID_KEY = 'card-room-user-id';

function createLocalUserId() {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getRole() {
  return wx.getStorageSync(ROLE_KEY) || '';
}

function setRole(role) {
  wx.setStorageSync(ROLE_KEY, role);
}

function getCurrentShopId() {
  return wx.getStorageSync(CURRENT_SHOP_KEY) || 'shop-a';
}

function setCurrentShopId(shopId) {
  wx.setStorageSync(CURRENT_SHOP_KEY, shopId);
}

function getCurrentMerchant() {
  return wx.getStorageSync(MERCHANT_KEY) || null;
}

function setCurrentMerchant(merchant) {
  wx.setStorageSync(MERCHANT_KEY, merchant);
}

function clearMerchantSession() {
  wx.removeStorageSync(MERCHANT_KEY);
}

function getUserProfile(defaultProfile) {
  return wx.getStorageSync(USER_PROFILE_KEY) || defaultProfile || null;
}

function saveUserProfile(profile, baseProfile = {}) {
  const merged = { ...baseProfile, ...getUserProfile(baseProfile), ...profile };
  wx.setStorageSync(USER_PROFILE_KEY, merged);
  return merged;
}

function getUserId() {
  let userId = wx.getStorageSync(USER_ID_KEY) || '';
  if (!userId) {
    userId = createLocalUserId();
    wx.setStorageSync(USER_ID_KEY, userId);
  }
  return userId;
}

module.exports = {
  clearMerchantSession,
  getCurrentMerchant,
  getCurrentShopId,
  getRole,
  getUserId,
  getUserProfile,
  saveUserProfile,
  setCurrentMerchant,
  setCurrentShopId,
  setRole
};
