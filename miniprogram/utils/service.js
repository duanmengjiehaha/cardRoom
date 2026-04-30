const store = require('./store');
const cloudService = require('./cloud');

let bootstrapPromise = null;
let bootstrapAt = 0;
const BOOTSTRAP_CACHE_MS = 5000;
const DEFAULT_USER_PROFILE = {
  nickName: '微信用户',
  avatarUrl: '/images/avatar.png',
  phone: '',
  authorized: false
};

function getFileExtension(path = '') {
  const matched = String(path).match(/(\.[a-zA-Z0-9]+)(?:[\?#].*)?$/);
  return matched ? matched[1] : '.png';
}

function shouldUploadRoomImage(image = '') {
  const value = String(image || '');
  if (!value) {
    return false;
  }
  if (value.startsWith('cloud://')) {
    return false;
  }
  if (value.startsWith('/images/')) {
    return false;
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return false;
  }
  return true;
}

function getCloudRequiredMessage() {
  return '请先配置云环境';
}

async function uploadRoomImage(shopId, imagePath) {
  if (!cloudService.canUseCloud()) {
    throw new Error(getCloudRequiredMessage());
  }
  const extension = getFileExtension(imagePath);
  const cloudPath = `room-images/${shopId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${extension}`;
  const result = await wx.cloud.uploadFile({
    cloudPath,
    filePath: imagePath
  });
  return result && result.fileID ? result.fileID : '';
}

async function bootstrap() {
  if (bootstrapPromise && Date.now() - bootstrapAt < BOOTSTRAP_CACHE_MS) {
    return bootstrapPromise;
  }

  if (!cloudService.canUseCloud()) {
    bootstrapPromise = Promise.resolve({
      ok: false,
      message: getCloudRequiredMessage()
    });
    bootstrapAt = Date.now();
    return bootstrapPromise;
  }

  bootstrapPromise = cloudService.callFunction('bootstrap')
    .then((result) => result || { ok: true })
    .catch((error) => ({
      ok: false,
      message: (error && (error.errMsg || error.message)) || 'bootstrap failed'
    }));

  bootstrapAt = Date.now();
  return bootstrapPromise;
}

async function refreshBootstrap() {
  bootstrapPromise = null;
  bootstrapAt = 0;
  return bootstrap();
}

async function loginMerchant(account, password) {
  if (!cloudService.canUseCloud()) {
    return null;
  }

  await bootstrap().catch(() => {});
  const result = await cloudService.callCloud('loginMerchant', { account, password });
  if (!result.ok || !result.merchant) {
    return null;
  }

  store.setCurrentMerchant(result.merchant);
  store.setCurrentShopId(result.merchant.shopId);
  store.setRole('merchant');
  return result.merchant;
}

async function createUserBooking(payload) {
  const requestPayload = {
    ...payload,
    clientUserId: store.getUserId()
  };
  if (!cloudService.canUseCloud()) {
    return {
      ok: false,
      message: getCloudRequiredMessage()
    };
  }
  const result = await cloudService.callCloud('createUserBooking', requestPayload);
  if (result && result.ok) {
    store.saveUserProfile({
      nickName: payload.userName,
      phone: payload.phone
    }, DEFAULT_USER_PROFILE);
  }
  return result;
}

async function recordShopVisit(shopId, source = 'browse') {
  const payload = {
    shopId,
    source,
    clientUserId: store.getUserId()
  };
  if (!cloudService.canUseCloud()) {
    return {
      ok: false,
      message: getCloudRequiredMessage()
    };
  }
  return cloudService.callCloud('recordShopVisit', payload);
}

async function updateShopHours(shopId, hours) {
  if (!cloudService.canUseCloud()) {
    return { ok: false, message: getCloudRequiredMessage() };
  }
  return cloudService.callCloud('updateShopHours', { shopId, hours });
}

async function updateMerchantProfile(payload) {
  if (!cloudService.canUseCloud()) {
    return { ok: false, message: getCloudRequiredMessage() };
  }
  return cloudService.callCloud('updateMerchantProfile', payload);
}

async function getShopQrCode(shopId) {
  if (!cloudService.canUseCloud()) {
    return {
      ok: false,
      message: 'cloud disabled'
    };
  }
  try {
    return await cloudService.callCloud('getShopQrCode', { shopId });
  } catch (error) {
    return {
      ok: false,
      message: (error && (error.errMsg || error.message)) || '二维码获取失败',
      errMsg: error && error.errMsg ? error.errMsg : ''
    };
  }
}

async function getUserHomeData(shopId) {
  if (!cloudService.canUseCloud()) {
    throw new Error(getCloudRequiredMessage());
  }
  const result = await cloudService.callCloud('getUserHomeData', { shopId });
  return {
    shop: result.shop || null,
    roomList: result.roomList || []
  };
}

async function getMerchantDashboard(shopId) {
  if (!cloudService.canUseCloud()) {
    throw new Error(getCloudRequiredMessage());
  }
  const result = await cloudService.callCloud('getDashboard', { shopId });
  return {
    shop: result.shop || null,
    stats: result.stats || {
      totalRooms: 0,
      idleRooms: 0,
      bookedRooms: 0,
      usingRooms: 0,
      todayOrders: 0
    },
    roomList: result.roomList || []
  };
}

async function getRoomContext(roomId) {
  if (!cloudService.canUseCloud()) {
    throw new Error(getCloudRequiredMessage());
  }
  const result = await cloudService.callCloud('getRoomContext', { roomId });
  return {
    room: result.room || null,
    shop: result.shop || null
  };
}

async function getMerchantProfileData(shopId, merchantId) {
  if (!cloudService.canUseCloud()) {
    throw new Error(getCloudRequiredMessage());
  }
  const result = await cloudService.callCloud('getMerchantProfileData', { shopId, merchantId });
  return {
    shop: result.shop || null,
    merchant: result.merchant || null
  };
}

async function saveRoom(payload) {
  if (!cloudService.canUseCloud()) {
    return { ok: false, message: getCloudRequiredMessage() };
  }
  const requestPayload = {
    ...payload
  };
  if (shouldUploadRoomImage(payload.image)) {
    const fileID = await uploadRoomImage(payload.shopId, payload.image);
    if (!fileID) {
      return {
        ok: false,
        message: '房间图片上传失败'
      };
    }
    requestPayload.image = fileID;
  }
  return cloudService.callCloud('saveRoom', requestPayload);
}

async function removeRoom(roomId, shopId) {
  if (!cloudService.canUseCloud()) {
    return { ok: false, message: getCloudRequiredMessage() };
  }
  return cloudService.callCloud('removeRoom', { roomId, shopId });
}

async function createOfflineLock(payload) {
  if (!cloudService.canUseCloud()) {
    return { ok: false, message: getCloudRequiredMessage() };
  }
  return cloudService.callCloud('createOfflineLock', payload);
}

async function listUserOrders() {
  if (!cloudService.canUseCloud()) {
    throw new Error(getCloudRequiredMessage());
  }
  const result = await cloudService.callCloud('listUserOrders');
  return result.orders || [];
}

async function listMerchantOrders(shopId) {
  if (!cloudService.canUseCloud()) {
    throw new Error(getCloudRequiredMessage());
  }
  const result = await cloudService.callCloud('listMerchantOrders', { shopId });
  return result.orders || [];
}

async function listHistory() {
  if (!cloudService.canUseCloud()) {
    throw new Error(getCloudRequiredMessage());
  }
  const result = await cloudService.callCloud('listHistory');
  return result.history || [];
}

async function cancelOrder(orderId) {
  if (!cloudService.canUseCloud()) {
    return {
      ok: false,
      message: getCloudRequiredMessage()
    };
  }
  return cloudService.callCloud('cancelOrder', { orderId });
}

async function verifyOrder(orderId, shopId) {
  if (!cloudService.canUseCloud()) {
    return { ok: false, message: getCloudRequiredMessage() };
  }
  return cloudService.callCloud('verifyOrder', { orderId, shopId });
}

async function getBookingSlots(shopId, roomId, dayLabel) {
  if (!cloudService.canUseCloud()) {
    throw new Error(getCloudRequiredMessage());
  }
  const result = await cloudService.callCloud('getBookingSlots', { shopId, roomId, dayLabel });
  return result.timeSlots || [];
}

async function getWechatPhoneNumber(code) {
  if (!cloudService.canUseCloud()) {
    return {
      ok: false,
      message: 'cloud disabled'
    };
  }
  try {
    return await cloudService.callCloud('getWechatPhoneNumber', { code });
  } catch (error) {
    return {
      ok: false,
      message: (error && error.errMsg) || String(error) || 'cloud unavailable'
    };
  }
}

module.exports = {
  bootstrap,
  cancelOrder,
  createOfflineLock,
  createUserBooking,
  getBookingSlots,
  getMerchantDashboard,
  getMerchantProfileData,
  getRoomContext,
  getShopQrCode,
  getUserHomeData,
  getWechatPhoneNumber,
  listMerchantOrders,
  listHistory,
  listUserOrders,
  loginMerchant,
  recordShopVisit,
  refreshBootstrap,
  removeRoom,
  saveRoom,
  updateMerchantProfile,
  updateShopHours,
  verifyOrder
};
