const cloud = require('wx-server-sdk');
const { getSeedData } = require('./seedData');
const TIMEZONE_OFFSET_MINUTES = 8 * 60;

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const collections = ['shops', 'rooms', 'merchants', 'users', 'orders', 'locks', 'history'];

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
  } catch (error) {
    const message = `${error && error.errMsg ? error.errMsg : ''} ${error && error.message ? error.message : ''}`;
    const alreadyExists = message.includes('already exists')
      || message.includes('ResourceExist')
      || message.includes('Table exist')
      || Number(error && error.errCode) === -501001;
    if (!alreadyExists) {
      throw error;
    }
  }
}

async function seedCollection(name, records) {
  const collection = db.collection(name);
  for (const record of records) {
    const existing = await collection.where({ id: record.id }).limit(1).get();
    if (!existing.data || !existing.data.length) {
      await collection.add({ data: record });
    }
  }
}

function addMonths(baseTs, months) {
  const date = new Date(baseTs);
  date.setMonth(date.getMonth() + Number(months || 0));
  return date.getTime();
}

async function patchShopBillingFields() {
  const [shops, merchants] = await Promise.all([
    getAll('shops'),
    getAll('merchants')
  ]);
  const timestamp = now();
  for (const shop of shops) {
    const data = {};
    if (!shop.qrCodeScene) data.qrCodeScene = `sid=${shop.id}`;
    if (!shop.paidMonths) data.paidMonths = 12;
    if (!shop.expiresAt) data.expiresAt = addMonths(shop.createdAt || timestamp, 12);
    if (Object.keys(data).length) {
      await db.collection('shops').doc(shop._id).update({ data });
    }
  }
  for (const shop of shops) {
    const expiresAt = shop.expiresAt || addMonths(shop.createdAt || timestamp, 12);
    const nextStatus = expiresAt < timestamp ? 'disabled' : (!shop.status ? 'enabled' : shop.status);
    if (shop.status !== nextStatus) {
      await db.collection('shops').doc(shop._id).update({
        data: {
          status: nextStatus,
          updatedAt: timestamp
        }
      });
    }
    const merchant = merchants.find((item) => item.shopId === shop.id);
    if (merchant && merchant.status !== nextStatus) {
      await db.collection('merchants').doc(merchant._id).update({
        data: {
          status: nextStatus,
          updatedAt: timestamp
        }
      });
    }
  }
}

async function ensureBaseData() {
  const seed = getSeedData();
  for (const name of collections) {
    await ensureCollection(name);
    await seedCollection(name, seed[name] || []);
  }
  await patchShopBillingFields();
}

function now() {
  return Date.now();
}

function pad(num) {
  return String(num).padStart(2, '0');
}

function getTimezoneDateParts(ts) {
  const shifted = ts + TIMEZONE_OFFSET_MINUTES * 60 * 1000;
  const date = new Date(shifted);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hours: date.getUTCHours(),
    minutes: date.getUTCMinutes()
  };
}

function sameDayLabel(ts) {
  const parts = getTimezoneDateParts(ts);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function formatDateTime(ts) {
  const parts = getTimezoneDateParts(ts);
  return `${sameDayLabel(ts)} ${pad(parts.hours)}:${pad(parts.minutes)}`;
}

function formatMinute(totalMinutes) {
  const safeMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${pad(hours)}:${pad(minutes)}`;
}

function toMinute(time) {
  const parts = String(time || '00:00').split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function buildTimestamp(dayLabel, time) {
  const [year, month, day] = dayLabel.split('-').map(Number);
  const [hours, minutes] = String(time).split(':').map(Number);
  return Date.UTC(year, month - 1, day, hours, minutes, 0, 0) - TIMEZONE_OFFSET_MINUTES * 60 * 1000;
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getUserOpenId() {
  const context = cloud.getWXContext ? cloud.getWXContext() : {};
  return context.OPENID || '';
}

function normalizePriceLabel(priceLabel) {
  return String(priceLabel || '').replace(/^\u53c2\u8003\u4ef7[:\uff1a]?\s*/, '').trim();
}

async function getAll(collectionName, where = null) {
  const query = where ? db.collection(collectionName).where(where) : db.collection(collectionName);
  const res = await query.get();
  return res.data || [];
}

async function resolveTempFileURL(fileID) {
  if (!fileID || !String(fileID).startsWith('cloud://')) {
    return fileID || '';
  }
  try {
    const tempResult = await cloud.getTempFileURL({
      fileList: [fileID]
    });
    const file = tempResult.fileList && tempResult.fileList.length ? tempResult.fileList[0] : null;
    return (file && file.tempFileURL) || fileID;
  } catch (error) {
    console.error('[api] resolveTempFileURL failed:', fileID, error);
    return fileID;
  }
}

async function withRoomImageURL(room) {
  if (!room) {
    return room;
  }
  return {
    ...room,
    imageUrl: await resolveTempFileURL(room.image)
  };
}

async function getSnapshot() {
  const [shops, rooms, merchants, orders, locks, history] = await Promise.all([
    getAll('shops'),
    getAll('rooms'),
    getAll('merchants'),
    getAll('orders'),
    getAll('locks'),
    getAll('history')
  ]);

  return { shops, rooms, merchants, orders, locks, history };
}

function normalizeOrdersAndLocks(snapshot) {
  const current = now();
  return {
    ...snapshot,
    orders: snapshot.orders.map((order) => {
      const expireAt = order.startAt + 30 * 60 * 1000;
      if (order.status === 'pending' && current > expireAt) {
        return { ...order, status: 'cancelled', cancelReason: 'timeout' };
      }
      return order;
    }),
    locks: snapshot.locks.filter((item) => item.endAt > current)
  };
}

function orderToView(order, room, shop, merchantView) {
  return {
    ...order,
    shopName: shop ? shop.name : '',
    roomName: room ? `${room.name} ${room.tableNo}` : '',
    statusText: order.status === 'pending'
      ? (merchantView ? '\u5f85\u6838\u9500' : '\u5f85\u4f7f\u7528')
      : order.status === 'completed'
        ? (merchantView ? '\u5df2\u6838\u9500' : '\u5df2\u5b8c\u6210')
        : '\u5df2\u53d6\u6d88',
    statusTag: order.status === 'pending' ? 'warning' : order.status === 'completed' ? 'success' : 'danger',
    timeRangeText: `${formatDateTime(order.startAt)} - ${formatDateTime(order.endAt).split(' ')[1]}`,
    durationText: `${Math.max((order.endAt - order.startAt) / (30 * 60 * 1000), 1) * 0.5}\u5c0f\u65f6`
  };
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

function getActiveBlocks(snapshot, shopId, roomId) {
  const current = now();
  const orderBlocks = snapshot.orders
    .filter((item) => item.shopId === shopId && item.roomId === roomId && item.status !== 'cancelled' && item.endAt > current)
    .map((item) => ({
      startAt: item.status === 'completed' && item.checkInAt ? Math.min(item.startAt, item.checkInAt) : item.startAt,
      endAt: item.endAt,
      type: item.status === 'completed' ? 'completed' : 'pending'
    }));

  const lockBlocks = snapshot.locks
    .filter((item) => item.shopId === shopId && item.roomId === roomId && item.endAt > current)
    .map((item) => ({
      startAt: item.startAt,
      endAt: item.endAt,
      type: 'lock'
    }));

  return [...orderBlocks, ...lockBlocks];
}

function hasOverlap(snapshot, shopId, roomId, startAt, endAt) {
  return getActiveBlocks(snapshot, shopId, roomId).some((item) => startAt < item.endAt && endAt > item.startAt);
}

function canDeleteRoom(snapshot, roomId, shopId) {
  const current = now();
  const hasFutureOrders = snapshot.orders.some((item) => item.roomId === roomId && item.shopId === shopId && item.status !== 'cancelled' && item.endAt > current);
  const hasLocks = snapshot.locks.some((item) => item.roomId === roomId && item.shopId === shopId && item.endAt > current);
  return !hasFutureOrders && !hasLocks;
}

async function replaceExpiredOrders(snapshot) {
  const changed = snapshot.orders.filter((order) => {
    const expireAt = order.startAt + 30 * 60 * 1000;
    return order.status === 'pending' && now() > expireAt;
  });

  for (const order of changed) {
    await db.collection('orders').where({ id: order.id }).update({
      data: {
        status: 'cancelled',
        cancelReason: 'timeout'
      }
    });
  }
}

async function cleanupExpiredLocks(snapshot) {
  const expired = snapshot.locks.filter((item) => item.endAt <= now());
  for (const lock of expired) {
    await db.collection('locks').where({ id: lock.id }).remove();
  }
}

async function normalizeCloudState() {
  const raw = await getSnapshot();
  await replaceExpiredOrders(raw);
  await cleanupExpiredLocks(raw);
  return normalizeOrdersAndLocks(await getSnapshot());
}

async function getDashboard(shopId) {
  const snapshot = await normalizeCloudState();
  const rooms = snapshot.rooms.filter((item) => item.shopId === shopId);
  const shop = snapshot.shops.find((item) => item.id === shopId) || null;
  const current = now();
  const idleStatus = '\u7a7a\u95f2';
  const bookedStatus = '\u5df2\u6709\u9884\u7ea6';
  const usingStatus = '\u4f7f\u7528\u4e2d';

  const roomList = await Promise.all(rooms.map(async (room) => {
    const blocks = getActiveBlocks(snapshot, shopId, room.id);
    const hasUsingBlock = blocks.some((item) => current >= item.startAt && current < item.endAt && (item.type === 'completed' || item.type === 'lock'));
    let status = idleStatus;
    if (hasUsingBlock) {
      status = usingStatus;
    } else if (blocks.length) {
      status = bookedStatus;
    }
    return withRoomImageURL({
      ...room,
      displayName: `${room.name} ${room.tableNo}`,
      status,
      statusTag: status === idleStatus ? 'success' : status === bookedStatus ? 'warning' : 'danger',
      canDelete: canDeleteRoom(snapshot, room.id, room.shopId)
    });
  }));

  return {
    shop,
    stats: {
      totalRooms: roomList.length,
      idleRooms: roomList.filter((item) => item.status === idleStatus).length,
      bookedRooms: roomList.filter((item) => item.status === bookedStatus).length,
      usingRooms: roomList.filter((item) => item.status === usingStatus).length,
      todayOrders: snapshot.orders.filter((item) => item.shopId === shopId && sameDayLabel(item.createdAt) === sameDayLabel(now())).length
    },
    roomList
  };
}

async function getUserHomeData(shopId) {
  const snapshot = await normalizeCloudState();
  const shop = snapshot.shops.find((item) => item.id === shopId) || null;
  const roomList = await Promise.all(snapshot.rooms
    .filter((item) => item.shopId === shopId)
    .map((room) => withRoomImageURL({
      ...room,
      priceLabel: normalizePriceLabel(room.priceLabel),
      displayName: `${room.name} ${room.tableNo}`
    })));

  return {
    shop,
    roomList
  };
}

async function getRoomContext(roomId) {
  const snapshot = await normalizeCloudState();
  const room = snapshot.rooms.find((item) => item.id === roomId) || null;
  const shop = room ? snapshot.shops.find((item) => item.id === room.shopId) || null : null;
  return {
    room: room ? await withRoomImageURL({ ...room, priceLabel: normalizePriceLabel(room.priceLabel) }) : null,
    shop
  };
}

async function getMerchantProfileData(shopId, merchantId) {
  const [shops, merchants] = await Promise.all([
    db.collection('shops').where({ id: shopId }).limit(1).get(),
    db.collection('merchants').where({ id: merchantId }).limit(1).get()
  ]);

  return {
    shop: shops.data && shops.data.length ? shops.data[0] : null,
    merchant: merchants.data && merchants.data.length ? merchants.data[0] : null
  };
}

async function getBookingSlots(shopId, roomId, dayLabel) {
  const snapshot = await normalizeCloudState();
  const shop = snapshot.shops.find((item) => item.id === shopId);
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
      } else if (hasOverlap(snapshot, shopId, roomId, startAt, endAt)) {
        status = 'occupied';
      }
      return { ...slot, startAt, endAt, status };
    });
}

async function createUserBooking(data) {
  const snapshot = await normalizeCloudState();
  const userOpenId = getUserOpenId();
  const shop = snapshot.shops.find((item) => item.id === data.shopId);
  const room = snapshot.rooms.find((item) => item.id === data.roomId);
  if (!shop || !room) {
    return { ok: false, message: '\u5e97\u94fa\u6216\u623f\u95f4\u4e0d\u5b58\u5728' };
  }
  if (!userOpenId) {
    return { ok: false, message: 'user not found' };
  }
  if (hasOverlap(snapshot, data.shopId, data.roomId, data.startAt, data.endAt)) {
    return { ok: false, message: '\u6240\u9009\u65f6\u6bb5\u5df2\u88ab\u5360\u7528\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9' };
  }

  await db.collection('orders').add({
    data: {
      id: createId('order'),
      userOpenId,
      clientUserId: data.clientUserId || '',
      shopId: data.shopId,
      roomId: data.roomId,
      userName: data.userName,
      phone: data.phone,
      startAt: data.startAt,
      endAt: data.endAt,
      createdAt: now(),
      status: 'pending',
      source: 'user'
    }
  });

  await recordShopVisit(data.shopId, 'booking', data.clientUserId || '');
  return { ok: true };
}

async function recordShopVisit(shopId, source = 'browse', clientUserId = '') {
  const userOpenId = getUserOpenId();
  const shops = await db.collection('shops').where({ id: shopId }).limit(1).get();
  const shop = shops.data && shops.data.length ? shops.data[0] : null;
  if (!shop) {
    return { ok: false, message: 'shop not found' };
  }
  if (!userOpenId) {
    return { ok: false, message: 'user not found' };
  }

  const historyCollection = db.collection('history');
  const existingRes = await historyCollection.where({ shopId, userOpenId }).limit(1).get();
  const existing = existingRes.data && existingRes.data.length ? existingRes.data[0] : null;
  const data = {
    userOpenId,
    clientUserId,
    shopId,
    shopName: shop.name,
    address: shop.address,
    hours: shop.hours,
    browsed: source === 'browse' || !!(existing && existing.browsed),
    booked: source === 'booking' || !!(existing && existing.booked),
    lastVisitAt: now(),
    lastSource: source
  };

  if (existing && existing._id) {
    await historyCollection.doc(existing._id).update({ data });
  } else {
    await historyCollection.add({ data: { id: createId('history'), ...data } });
  }

  return { ok: true };
}

async function updateMerchantProfile(data) {
  if (data.name || data.address || data.hours) {
    const shopData = {};
    if (data.name) {
      shopData.name = data.name;
    }
    if (data.address) {
      shopData.address = data.address;
    }
    if (data.hours) {
      shopData.hours = data.hours;
    }
    shopData.updatedAt = now();
    await db.collection('shops').where({ id: data.shopId }).update({ data: shopData });
  }

  if (data.phone) {
    await db.collection('merchants').where({ id: data.merchantId }).update({
      data: {
        phone: data.phone,
        updatedAt: now()
      }
    });
  }

  const [shops, merchants] = await Promise.all([
    db.collection('shops').where({ id: data.shopId }).limit(1).get(),
    db.collection('merchants').where({ id: data.merchantId }).limit(1).get()
  ]);

  return {
    ok: true,
    shop: shops.data && shops.data.length ? shops.data[0] : null,
    merchant: merchants.data && merchants.data.length ? merchants.data[0] : null
  };
}

function buildShopQrScene(shopId) {
  return `sid=${shopId}`;
}

async function resolveShopQrCode(shopId) {
  try {
    const shopRes = await db.collection('shops').where({ id: shopId }).limit(1).get();
    const shop = shopRes.data && shopRes.data.length ? shopRes.data[0] : null;
    if (!shop) {
      return { ok: false, message: 'shop not found' };
    }

    let fileID = shop.qrCodeFileId || '';
    const scene = shop.qrCodeScene || buildShopQrScene(shopId);
    let qrCodeUpdatedAt = shop.qrCodeUpdatedAt || shop.updatedAt || 0;

    if (!fileID) {
      const response = await cloud.openapi.wxacode.getUnlimited({
        scene,
        page: 'pages/home/index',
        checkPath: false
      });
      const upload = await cloud.uploadFile({
        cloudPath: `shop-qrcodes/${shopId}.png`,
        fileContent: response.buffer
      });
      fileID = upload.fileID;
      qrCodeUpdatedAt = now();
      await db.collection('shops').doc(shop._id).update({
        data: {
          qrCodeFileId: fileID,
          qrCodeScene: scene,
          qrCodeUpdatedAt,
          updatedAt: qrCodeUpdatedAt
        }
      });
    }

    const tempResult = await cloud.getTempFileURL({
      fileList: [fileID]
    });
    const tempFileURL = tempResult.fileList && tempResult.fileList.length
      ? tempResult.fileList[0].tempFileURL || ''
      : '';

    return {
      ok: true,
      shopId,
      shopName: shop.name,
      fileID,
      tempFileURL,
      updatedAt: qrCodeUpdatedAt
    };
  } catch (error) {
    console.error('[api] resolveShopQrCode failed:', error);
    const errCode = error && (error.errCode || error.code) ? String(error.errCode || error.code) : '';
    const errMsg = error && (error.errMsg || error.message) ? String(error.errMsg || error.message) : String(error || '');
    return {
      ok: false,
      message: `\u4e8c\u7ef4\u7801\u751f\u6210\u5931\u8d25${errCode ? ` [${errCode}]` : ''}${errMsg ? `: ${errMsg}` : ''}`,
      errCode,
      errMsg
    };
  }
}

async function getShopQrCode(shopId) {
  return resolveShopQrCode(shopId);
}

async function saveRoom(data) {
  if (data.id) {
    await db.collection('rooms').where({ id: data.id, shopId: data.shopId }).update({
      data: {
        name: data.name,
        tableNo: data.tableNo,
        priceLabel: normalizePriceLabel(data.priceLabel),
        image: data.image,
        updatedAt: now()
      }
    });
    return { ok: true };
  }

  await db.collection('rooms').add({
    data: {
      id: createId('room'),
      shopId: data.shopId,
      name: data.name,
      tableNo: data.tableNo,
      priceLabel: normalizePriceLabel(data.priceLabel),
      image: data.image,
      createdAt: now(),
      updatedAt: now()
    }
  });
  return { ok: true };
}

exports.main = async (event) => {
  const { action, data = {} } = event || {};

  await ensureBaseData();

  if (action === 'healthcheck') {
    return { ok: true, now: Date.now() };
  }

  if (action === 'bootstrapSnapshot') {
    return {
      ok: true,
      ...(await normalizeCloudState())
    };
  }

  if (action === 'loginMerchant') {
    const merchants = await db.collection('merchants').where({
      account: data.account,
      password: data.password
    }).limit(1).get();
    const merchant = merchants.data && merchants.data.length ? merchants.data[0] : null;
    if (!merchant) {
      return {
        ok: false,
        merchant: null
      };
    }
    const shops = await db.collection('shops').where({ id: merchant.shopId }).limit(1).get();
    const shop = shops.data && shops.data.length ? shops.data[0] : null;
    const merchantEnabled = !merchant.status || merchant.status === 'enabled';
    const shopEnabled = !shop || !shop.status || shop.status === 'enabled';

    return {
      ok: merchantEnabled && shopEnabled,
      merchant: merchantEnabled && shopEnabled ? merchant : null
    };
  }

  if (action === 'getDashboard') {
    return {
      ok: true,
      ...(await getDashboard(data.shopId))
    };
  }

  if (action === 'getUserHomeData') {
    return {
      ok: true,
      ...(await getUserHomeData(data.shopId))
    };
  }

  if (action === 'getRoomContext') {
    return {
      ok: true,
      ...(await getRoomContext(data.roomId))
    };
  }

  if (action === 'getMerchantProfileData') {
    return {
      ok: true,
      ...(await getMerchantProfileData(data.shopId, data.merchantId))
    };
  }

  if (action === 'getBookingSlots') {
    return {
      ok: true,
      timeSlots: await getBookingSlots(data.shopId, data.roomId, data.dayLabel)
    };
  }

  if (action === 'getWechatPhoneNumber') {
    try {
      const phoneResult = await cloud.openapi.phonenumber.getPhoneNumber({
        code: data.code
      });
      const phoneInfo = phoneResult && phoneResult.phoneInfo ? phoneResult.phoneInfo : {};
      return {
        ok: true,
        phoneNumber: phoneInfo.phoneNumber || '',
        purePhoneNumber: phoneInfo.purePhoneNumber || '',
        countryCode: phoneInfo.countryCode || ''
      };
    } catch (error) {
      return {
        ok: false,
        message: 'get phone failed',
        error: error && error.errMsg ? error.errMsg : String(error)
      };
    }
  }

  if (action === 'createUserBooking') {
    return createUserBooking(data);
  }

  if (action === 'recordShopVisit') {
    return recordShopVisit(data.shopId, data.source, data.clientUserId || '');
  }

  if (action === 'saveRoom') {
    return saveRoom(data);
  }

  if (action === 'updateShopHours') {
    await db.collection('shops').where({ id: data.shopId }).update({
      data: {
        hours: data.hours,
        updatedAt: now()
      }
    });
    return { ok: true };
  }

  if (action === 'updateMerchantProfile') {
    return updateMerchantProfile(data);
  }

  if (action === 'getShopQrCode') {
    return getShopQrCode(data.shopId);
  }

  if (action === 'removeRoom') {
    const snapshot = await normalizeCloudState();
    if (!canDeleteRoom(snapshot, data.roomId, data.shopId)) {
      return { ok: false, message: '\u8be5\u623f\u95f4\u5b58\u5728\u672a\u7ed3\u675f\u9884\u7ea6\u6216\u9501\u53f0\uff0c\u6682\u4e0d\u80fd\u5220\u9664' };
    }
    await db.collection('rooms').where({ id: data.roomId, shopId: data.shopId }).remove();
    return { ok: true };
  }

  if (action === 'createOfflineLock') {
    const snapshot = await normalizeCloudState();
    if (hasOverlap(snapshot, data.shopId, data.roomId, data.startAt, data.endAt)) {
      return { ok: false, message: '\u8be5\u65f6\u6bb5\u5df2\u88ab\u9884\u7ea6\u6216\u9501\u5b9a' };
    }
    await db.collection('locks').add({
      data: {
        id: createId('lock'),
        shopId: data.shopId,
        roomId: data.roomId,
        startAt: data.startAt,
        endAt: data.endAt,
        createdAt: now(),
        customerName: data.customerName || '',
        phone: data.phone || ''
      }
    });
    return { ok: true };
  }

  if (action === 'listUserOrders') {
    const snapshot = await normalizeCloudState();
    const userOpenId = getUserOpenId();
    return {
      ok: true,
      orders: snapshot.orders
        .filter((order) => order.userOpenId && order.userOpenId === userOpenId)
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((order) => orderToView(order, snapshot.rooms.find((room) => room.id === order.roomId), snapshot.shops.find((shop) => shop.id === order.shopId), false))
    };
  }

  if (action === 'listHistory') {
    const snapshot = await normalizeCloudState();
    const userOpenId = getUserOpenId();
    return {
      ok: true,
      history: snapshot.history
        .filter((item) => item.userOpenId && item.userOpenId === userOpenId)
        .slice()
        .sort((a, b) => b.lastVisitAt - a.lastVisitAt)
        .map((item) => ({
          ...item,
          browsed: typeof item.browsed === 'boolean' ? item.browsed : true,
          booked: !!item.booked,
          lastVisitText: formatDateTime(item.lastVisitAt)
        }))
    };
  }

  if (action === 'listMerchantOrders') {
    const snapshot = await normalizeCloudState();
    return {
      ok: true,
      orders: snapshot.orders
        .filter((order) => order.shopId === data.shopId)
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((order) => orderToView(order, snapshot.rooms.find((room) => room.id === order.roomId), snapshot.shops.find((shop) => shop.id === order.shopId), true))
    };
  }

  if (action === 'cancelOrder') {
    const userOpenId = getUserOpenId();
    await db.collection('orders').where({ id: data.orderId, userOpenId }).update({
      data: {
        status: 'cancelled',
        cancelReason: 'user'
      }
    });
    return { ok: true };
  }

  if (action === 'verifyOrder') {
    await db.collection('orders').where({ id: data.orderId, shopId: data.shopId }).update({
      data: {
        status: 'completed',
        checkInAt: now()
      }
    });
    return { ok: true };
  }

  return {
    ok: false,
    message: `Unknown action: ${action || 'empty'}`
  };
};

