const DB_KEY = 'card-room-mock-db-v1';
const ROLE_KEY = 'card-room-role';
const CURRENT_SHOP_KEY = 'card-room-current-shop-id';
const MERCHANT_KEY = 'card-room-current-merchant';
const USER_PROFILE_KEY = 'card-room-user-profile';
const USER_ID_KEY = 'card-room-user-id';

const DEFAULT_NOTICE = '预约成功后请在30分钟内到店核验，超时未到店系统会自动取消预约并释放时段。';
const DEFAULT_ROOM_IMAGE = '/images/default-goods-image.png';
const DEFAULT_AVATAR = '/images/avatar.png';

function now() {
  return Date.now();
}

function pad(num) {
  return String(num).padStart(2, '0');
}

function toMinute(time) {
  const parts = String(time || '00:00').split(':').map(Number);
  const hours = Number.isNaN(parts[0]) ? 0 : parts[0];
  const minutes = Number.isNaN(parts[1]) ? 0 : parts[1];
  return hours * 60 + minutes;
}

function formatMinute(totalMinutes) {
  const safeMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${pad(hours)}:${pad(minutes)}`;
}

function sameDayLabel(ts) {
  const date = new Date(ts);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateTime(ts) {
  const date = new Date(ts);
  return `${sameDayLabel(ts)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildTimestamp(dayLabel, time) {
  const [year, month, day] = dayLabel.split('-').map(Number);
  const [hours, minutes] = String(time).split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePriceLabel(priceLabel) {
  return String(priceLabel || '').replace(/^参考价[:：]?\s*/, '').trim();
}

function getUserId() {
  let userId = wx.getStorageSync(USER_ID_KEY) || '';
  if (!userId) {
    userId = createId('user');
    wx.setStorageSync(USER_ID_KEY, userId);
  }
  return userId;
}

function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

function getDefaultDb() {
  return {
    shops: [
      {
        id: 'shop-a',
        name: '乐闲棋牌会所',
        address: '上海市浦东新区云桥路88号2楼',
        hours: { open: '09:00', close: '23:30' },
        notice: DEFAULT_NOTICE
      },
      {
        id: 'shop-b',
        name: '聚友棋牌茶舍',
        address: '上海市闵行区七莘路516号3楼',
        hours: { open: '10:00', close: '23:30' },
        notice: DEFAULT_NOTICE
      }
    ],
    rooms: [
      { id: 'room-a1', shopId: 'shop-a', name: '观景包间', tableNo: 'A101', priceLabel: '参考价 98元/小时', image: DEFAULT_ROOM_IMAGE },
      { id: 'room-a2', shopId: 'shop-a', name: '四人轻享房', tableNo: 'A202', priceLabel: '参考价 68元/小时', image: DEFAULT_ROOM_IMAGE },
      { id: 'room-a3', shopId: 'shop-a', name: '商务对局室', tableNo: 'A303', priceLabel: '参考价 88元/小时', image: DEFAULT_ROOM_IMAGE },
      { id: 'room-b1', shopId: 'shop-b', name: '临窗静音房', tableNo: 'B201', priceLabel: '参考价 78元/小时', image: DEFAULT_ROOM_IMAGE },
      { id: 'room-b2', shopId: 'shop-b', name: '好友对战室', tableNo: 'B202', priceLabel: '参考价 58元/小时', image: DEFAULT_ROOM_IMAGE }
    ],
    merchants: [
      { id: 'merchant-a', shopId: 'shop-a', account: 'shopa', password: '123456', managerName: '陈店长', phone: '13800138000' },
      { id: 'merchant-b', shopId: 'shop-b', account: 'shopb', password: '123456', managerName: '刘店长', phone: '13900139000' }
    ],
    orders: [],
    locks: [],
    history: []
  };
}

function getDb() {
  const db = wx.getStorageSync(DB_KEY);
  if (db && db.shops && db.rooms) {
    return db;
  }
  const defaultDb = getDefaultDb();
  wx.setStorageSync(DB_KEY, defaultDb);
  return defaultDb;
}

function setDb(db) {
  wx.setStorageSync(DB_KEY, db);
  return db;
}

function hydrateDb(snapshot) {
  const nextDb = {
    shops: snapshot.shops || [],
    rooms: snapshot.rooms || [],
    merchants: snapshot.merchants || [],
    orders: snapshot.orders || [],
    locks: snapshot.locks || [],
    history: snapshot.history || []
  };
  setDb(nextDb);
  return nextDb;
}

function normalizeStatus(db) {
  const nextDb = clone(db);
  const current = now();

  nextDb.orders = nextDb.orders.map((order) => {
    const expireAt = order.startAt + 30 * 60 * 1000;
    if (order.status === 'pending' && current > expireAt) {
      return { ...order, status: 'cancelled', cancelReason: 'timeout' };
    }
    return order;
  });

  nextDb.locks = nextDb.locks.filter((item) => item.endAt > current);
  return nextDb;
}

function syncDb() {
  const db = normalizeStatus(getDb());
  setDb(db);
  return db;
}

function ensureSeedData() {
  syncDb();
  getUserId();
  if (!wx.getStorageSync(USER_PROFILE_KEY)) {
    wx.setStorageSync(USER_PROFILE_KEY, {
      nickName: '微信用户',
      avatarUrl: DEFAULT_AVATAR,
      phone: ''
    });
  }
  if (!wx.getStorageSync(CURRENT_SHOP_KEY)) {
    wx.setStorageSync(CURRENT_SHOP_KEY, 'shop-a');
  }
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

function getUserProfile() {
  return wx.getStorageSync(USER_PROFILE_KEY) || {
    nickName: '微信用户',
    avatarUrl: DEFAULT_AVATAR,
    phone: ''
  };
}

function saveUserProfile(profile) {
  const merged = { ...getUserProfile(), ...profile };
  wx.setStorageSync(USER_PROFILE_KEY, merged);
  return merged;
}

function getCurrentMerchant() {
  return wx.getStorageSync(MERCHANT_KEY) || null;
}

function clearMerchantSession() {
  wx.removeStorageSync(MERCHANT_KEY);
}

function loginMerchant(account, password) {
  const db = syncDb();
  const merchant = db.merchants.find((item) => item.account === account && item.password === password);
  if (!merchant) {
    return null;
  }
  const shop = db.shops.find((item) => item.id === merchant.shopId);
  if ((merchant.status && merchant.status !== 'enabled') || (shop && shop.status && shop.status !== 'enabled')) {
    return null;
  }
  wx.setStorageSync(MERCHANT_KEY, merchant);
  setCurrentShopId(merchant.shopId);
  setRole('merchant');
  return merchant;
}

function getShopById(shopId) {
  const db = syncDb();
  return db.shops.find((item) => item.id === shopId) || null;
}

function listRoomsByShopId(shopId) {
  const db = syncDb();
  return db.rooms
    .filter((item) => item.shopId === shopId)
    .map((item) => ({
      ...item,
      priceLabel: normalizePriceLabel(item.priceLabel)
    }));
}

function getRoomById(roomId) {
  const db = syncDb();
  const room = db.rooms.find((item) => item.id === roomId);
  return room
    ? {
      ...room,
      priceLabel: normalizePriceLabel(room.priceLabel)
    }
    : null;
}

function orderToView(order, room, shop, merchantView) {
  return {
    id: order.id,
    shopId: order.shopId,
    roomId: order.roomId,
    shopName: shop ? shop.name : '',
    roomName: room ? `${room.name} ${room.tableNo}` : '',
    userName: order.userName,
    phone: order.phone,
    startAt: order.startAt,
    endAt: order.endAt,
    createdAt: order.createdAt,
    status: order.status,
    statusText: statusText(order.status, merchantView),
    statusTag: statusTag(order.status),
    timeRangeText: `${formatDateTime(order.startAt)} - ${formatDateTime(order.endAt).split(' ')[1]}`,
    durationText: `${Math.max((order.endAt - order.startAt) / (30 * 60 * 1000), 1) * 0.5}小时`,
    source: order.source || 'user'
  };
}

function statusText(status, merchantView) {
  if (status === 'pending') {
    return merchantView ? '待核销' : '待使用';
  }
  if (status === 'completed') {
    return merchantView ? '已核销' : '已完成';
  }
  return '已取消';
}

function statusTag(status) {
  if (status === 'pending') {
    return 'warning';
  }
  if (status === 'completed') {
    return 'success';
  }
  return 'danger';
}

function listUserOrders() {
  const db = syncDb();
  const userId = getUserId();
  return db.orders
    .filter((order) => order.userId === userId || order.clientUserId === userId)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((order) => orderToView(order, db.rooms.find((room) => room.id === order.roomId), db.shops.find((shop) => shop.id === order.shopId), false));
}

function listMerchantOrders(shopId) {
  const db = syncDb();
  return db.orders
    .filter((order) => order.shopId === shopId)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((order) => orderToView(order, db.rooms.find((room) => room.id === order.roomId), db.shops.find((shop) => shop.id === order.shopId), true));
}

function recordShopVisit(shopId, source = 'browse') {
  const db = syncDb();
  const userId = getUserId();
  const shop = db.shops.find((item) => item.id === shopId);
  if (!shop) {
    return;
  }
  const index = db.history.findIndex((item) => item.shopId === shopId && item.userId === userId);
  const previous = index >= 0 ? db.history[index] : null;
  const record = {
    userId,
    clientUserId: userId,
    shopId,
    shopName: shop.name,
    address: shop.address,
    hours: shop.hours,
    browsed: source === 'browse' || !!(previous && previous.browsed),
    booked: source === 'booking' || !!(previous && previous.booked),
    lastVisitAt: now(),
    lastSource: source
  };
  if (index >= 0) {
    db.history.splice(index, 1);
  }
  db.history.unshift(record);
  setDb(db);
}

function listHistory() {
  const db = syncDb();
  const userId = getUserId();
  return db.history.filter((item) => item.userId === userId || item.clientUserId === userId).map((item) => ({
    ...item,
    browsed: typeof item.browsed === 'boolean' ? item.browsed : true,
    booked: !!item.booked,
    lastVisitText: formatDateTime(item.lastVisitAt)
  }));
}

function getActiveBlocks(shopId, roomId) {
  const db = syncDb();
  const orderBlocks = db.orders
    .filter((item) => item.shopId === shopId && item.roomId === roomId && item.status !== 'cancelled' && item.endAt > now())
    .map((item) => ({
      startAt: item.status === 'completed' && item.checkInAt ? Math.min(item.startAt, item.checkInAt) : item.startAt,
      endAt: item.endAt,
      type: item.status === 'completed' ? 'completed' : 'pending'
    }));

  const lockBlocks = db.locks
    .filter((item) => item.shopId === shopId && item.roomId === roomId && item.endAt > now())
    .map((item) => ({
      startAt: item.startAt,
      endAt: item.endAt,
      type: 'lock'
    }));

  return [...orderBlocks, ...lockBlocks];
}

function hasOverlap(shopId, roomId, startAt, endAt) {
  return getActiveBlocks(shopId, roomId).some((item) => startAt < item.endAt && endAt > item.startAt);
}

function canDeleteRoom(roomId, shopId) {
  const db = syncDb();
  const current = now();
  const hasFutureOrders = db.orders.some((item) => item.roomId === roomId && item.shopId === shopId && item.status !== 'cancelled' && item.endAt > current);
  const hasLocks = db.locks.some((item) => item.roomId === roomId && item.shopId === shopId && item.endAt > current);
  return !hasFutureOrders && !hasLocks;
}

function createUserBooking(payload) {
  const db = syncDb();
  const shop = db.shops.find((item) => item.id === payload.shopId);
  const room = db.rooms.find((item) => item.id === payload.roomId);
  if (!shop || !room) {
    return { ok: false, message: '店铺或房间不存在' };
  }
  if (hasOverlap(payload.shopId, payload.roomId, payload.startAt, payload.endAt)) {
    return { ok: false, message: '所选时段已被占用，请重新选择' };
  }
  db.orders.unshift({
    id: createId('order'),
    userId: getUserId(),
    clientUserId: payload.clientUserId || getUserId(),
    shopId: payload.shopId,
    roomId: payload.roomId,
    userName: payload.userName,
    phone: payload.phone,
    startAt: payload.startAt,
    endAt: payload.endAt,
    createdAt: now(),
    status: 'pending',
    source: 'user'
  });
  setDb(db);
  recordShopVisit(payload.shopId, 'booking');
  saveUserProfile({ phone: payload.phone });
  return { ok: true };
}

function cancelOrder(orderId) {
  const db = syncDb();
  const userId = getUserId();
  const target = db.orders.find((item) => item.id === orderId && (item.userId === userId || item.clientUserId === userId));
  if (!target || target.status !== 'pending') {
    return { ok: false, message: '当前订单不可取消' };
  }
  target.status = 'cancelled';
  target.cancelReason = 'user';
  setDb(db);
  return { ok: true };
}

function verifyOrder(orderId, shopId) {
  const db = syncDb();
  const target = db.orders.find((item) => item.id === orderId && item.shopId === shopId);
  if (!target || target.status !== 'pending') {
    return { ok: false, message: '当前订单不可核销' };
  }
  target.status = 'completed';
  target.checkInAt = now();
  setDb(db);
  return { ok: true };
}

function getBusinessSlots(hours) {
  const slots = [];
  const open = toMinute(hours.open);
  const close = toMinute(hours.close);
  for (let start = 0; start < 1440; start += 30) {
    const end = start + 30;
    let inBusiness = false;
    if (open < close) {
      inBusiness = start >= open && end <= close;
    } else if (open > close) {
      inBusiness = start >= open || end <= close;
    } else {
      inBusiness = true;
    }
    slots.push({
      time: formatMinute(start),
      startMinute: start,
      endMinute: end,
      inBusiness
    });
  }
  return slots;
}

function getBookingSlots(shopId, roomId, dayLabel) {
  const shop = getShopById(shopId);
  if (!shop) {
    return [];
  }
  return getBusinessSlots(shop.hours)
    .filter((slot) => slot.inBusiness)
    .map((slot) => {
      const startAt = buildTimestamp(dayLabel, slot.time);
      const endAt = startAt + 30 * 60 * 1000;
      let status = 'available';
      if (startAt <= now()) {
        status = 'past';
      } else if (hasOverlap(shopId, roomId, startAt, endAt)) {
        status = 'occupied';
      }
      return { ...slot, startAt, endAt, status };
    });
}

function getDashboard(shopId) {
  const db = syncDb();
  const rooms = db.rooms.filter((item) => item.shopId === shopId);
  const shop = db.shops.find((item) => item.id === shopId);
  const current = now();

  const roomList = rooms.map((room) => {
    const blocks = getActiveBlocks(shopId, room.id);
    const hasUsingBlock = blocks.some((item) => current >= item.startAt && current < item.endAt && (item.type === 'completed' || item.type === 'lock'));
    let status = '空闲';
    if (hasUsingBlock) {
      status = '使用中';
    } else if (blocks.length) {
      status = '已有预约';
    }

    return {
      ...room,
      priceLabel: normalizePriceLabel(room.priceLabel),
      displayName: `${room.name} ${room.tableNo}`,
      status,
      statusTag: status === '空闲' ? 'success' : status === '已有预约' ? 'warning' : 'danger',
      canDelete: canDeleteRoom(room.id, room.shopId)
    };
  });

  const stats = {
    totalRooms: roomList.length,
    idleRooms: roomList.filter((item) => item.status === '空闲').length,
    bookedRooms: roomList.filter((item) => item.status === '已有预约').length,
    usingRooms: roomList.filter((item) => item.status === '使用中').length,
    todayOrders: db.orders.filter((item) => item.shopId === shopId && sameDayLabel(item.createdAt) === sameDayLabel(now())).length
  };

  return { shop, stats, roomList };
}

function saveRoom(payload) {
  const db = syncDb();
  if (payload.id) {
    const target = db.rooms.find((item) => item.id === payload.id && item.shopId === payload.shopId);
    if (!target) {
      return { ok: false, message: '房间不存在' };
    }
    target.name = payload.name;
    target.tableNo = payload.tableNo;
    target.priceLabel = normalizePriceLabel(payload.priceLabel);
    target.image = payload.image || DEFAULT_ROOM_IMAGE;
    setDb(db);
    return { ok: true };
  }

  db.rooms.push({
    id: createId('room'),
    shopId: payload.shopId,
    name: payload.name,
    tableNo: payload.tableNo,
    priceLabel: normalizePriceLabel(payload.priceLabel),
    image: payload.image || DEFAULT_ROOM_IMAGE
  });
  setDb(db);
  return { ok: true };
}

function removeRoom(roomId, shopId) {
  const db = syncDb();
  if (!canDeleteRoom(roomId, shopId)) {
    return { ok: false, message: '该房间存在未结束预约或锁台，暂不能删除' };
  }
  db.rooms = db.rooms.filter((item) => !(item.id === roomId && item.shopId === shopId));
  setDb(db);
  return { ok: true };
}

function createOfflineLock(payload) {
  const db = syncDb();
  if (payload.endAt - payload.startAt < 30 * 60 * 1000) {
    return { ok: false, message: '线下锁台时长不能少于30分钟' };
  }
  if (hasOverlap(payload.shopId, payload.roomId, payload.startAt, payload.endAt)) {
    return { ok: false, message: '该时段已被预约或锁定' };
  }
  db.locks.unshift({
    id: createId('lock'),
    shopId: payload.shopId,
    roomId: payload.roomId,
    startAt: payload.startAt,
    endAt: payload.endAt,
    createdAt: now(),
    customerName: payload.customerName || '',
    phone: payload.phone || ''
  });
  setDb(db);
  return { ok: true };
}

function updateShopHours(shopId, hours) {
  const db = syncDb();
  const target = db.shops.find((item) => item.id === shopId);
  if (!target) {
    return { ok: false, message: '店铺不存在' };
  }
  target.hours = hours;
  setDb(db);
  return { ok: true };
}

function updateMerchantProfile(payload) {
  const db = syncDb();
  const shop = db.shops.find((item) => item.id === payload.shopId);
  const merchant = db.merchants.find((item) => item.id === payload.merchantId);
  if (!shop || !merchant) {
    return { ok: false, message: 'shop or merchant not found' };
  }
  if (payload.name) {
    shop.name = payload.name;
  }
  if (payload.address) {
    shop.address = payload.address;
  }
  if (payload.hours) {
    shop.hours = payload.hours;
  }
  if (payload.phone) {
    merchant.phone = payload.phone;
  }
  setDb(db);
  wx.setStorageSync(MERCHANT_KEY, merchant);
  return {
    ok: true,
    shop,
    merchant
  };
}

module.exports = {
  DEFAULT_AVATAR,
  DEFAULT_ROOM_IMAGE,
  buildTimestamp,
  cancelOrder,
  clearMerchantSession,
  createOfflineLock,
  createUserBooking,
  ensureSeedData,
  formatDateTime,
  formatMinute,
  getBookingSlots,
  getCurrentMerchant,
  getCurrentShopId,
  getDashboard,
  getRole,
  getRoomById,
  getShopById,
  getUserId,
  getUserProfile,
  listHistory,
  listMerchantOrders,
  listRoomsByShopId,
  listUserOrders,
  loginMerchant,
  recordShopVisit,
  removeRoom,
  saveRoom,
  saveUserProfile,
  hydrateDb,
  setCurrentShopId,
  setRole,
  syncDb,
  toMinute,
  updateMerchantProfile,
  updateShopHours,
  verifyOrder
};
