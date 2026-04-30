const cloud = require('wx-server-sdk');
const { getSeedData, DEFAULT_NOTICE, DEFAULT_ROOM_IMAGE } = require('./seedData');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const collections = ['shops', 'rooms', 'merchants', 'orders', 'locks', 'history', 'admins'];

function now() {
  return Date.now();
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function pad(num) {
  return String(num).padStart(2, '0');
}

function formatDateTime(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addMonths(baseTs, months) {
  const date = new Date(baseTs);
  date.setMonth(date.getMonth() + Number(months || 0));
  return date.getTime();
}

function normalizeStatus(value) {
  return value === 'disabled' || value === 'deleted' ? value : 'enabled';
}

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
  } catch (error) {
    const message = `${error && error.errMsg ? error.errMsg : ''} ${error && error.message ? error.message : ''}`;
    const alreadyExists = message.includes('already exists')
      || message.includes('ResourceExist')
      || message.includes('Table exist')
      || Number(error && error.errCode) === -501001;
    if (!alreadyExists) throw error;
  }
}

async function getAll(collectionName, where = null) {
  const collection = db.collection(collectionName);
  const list = [];
  let skip = 0;
  const limit = 100;
  while (true) {
    const query = where ? collection.where(where) : collection;
    const res = await query.skip(skip).limit(limit).get();
    const rows = res.data || [];
    list.push(...rows);
    if (rows.length < limit) break;
    skip += limit;
  }
  return list;
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

async function patchMissingFields() {
  const [shops, merchants, rooms, admins] = await Promise.all([
    getAll('shops'),
    getAll('merchants'),
    getAll('rooms'),
    getAll('admins')
  ]);
  const timestamp = now();
  for (const shop of shops) {
    const data = {};
    if (!shop.notice) data.notice = DEFAULT_NOTICE;
    if (!shop.status) data.status = 'enabled';
    if (!shop.qrCodeScene) data.qrCodeScene = `sid=${shop.id}`;
    if (!shop.paidMonths) data.paidMonths = 12;
    if (!shop.expiresAt) data.expiresAt = addMonths(shop.createdAt || timestamp, 12);
    if (!shop.createdAt) data.createdAt = timestamp;
    if (!shop.updatedAt) data.updatedAt = timestamp;
    if (Object.keys(data).length) await db.collection('shops').doc(shop._id).update({ data });
  }
  for (const merchant of merchants) {
    const data = {};
    if (!merchant.status) data.status = 'enabled';
    if (!merchant.createdAt) data.createdAt = timestamp;
    if (!merchant.updatedAt) data.updatedAt = timestamp;
    if (Object.keys(data).length) await db.collection('merchants').doc(merchant._id).update({ data });
  }
  for (const room of rooms) {
    const data = {};
    if (!room.image) data.image = DEFAULT_ROOM_IMAGE;
    if (!room.createdAt) data.createdAt = timestamp;
    if (!room.updatedAt) data.updatedAt = timestamp;
    if (Object.keys(data).length) await db.collection('rooms').doc(room._id).update({ data });
  }
  for (const admin of admins) {
    const data = {};
    if (!admin.status) data.status = 'enabled';
    if (!admin.createdAt) data.createdAt = timestamp;
    if (!admin.updatedAt) data.updatedAt = timestamp;
    if (Object.keys(data).length) await db.collection('admins').doc(admin._id).update({ data });
  }
}

async function syncExpiredMerchantStatus() {
  const [shops, merchants] = await Promise.all([
    getAll('shops'),
    getAll('merchants')
  ]);
  const timestamp = now();
  for (const shop of shops) {
    const expired = !!shop.expiresAt && shop.expiresAt < timestamp;
    const nextStatus = expired ? 'disabled' : normalizeStatus(shop.status);
    const merchant = merchants.find((item) => item.shopId === shop.id);
    if (shop.status !== nextStatus && shop._id) {
      await db.collection('shops').doc(shop._id).update({
        data: {
          status: nextStatus,
          updatedAt: timestamp
        }
      });
    }
    if (merchant && merchant.status !== nextStatus && merchant._id) {
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
  await patchMissingFields();
  await syncExpiredMerchantStatus();
}

async function getSnapshot() {
  const [shops, merchants, rooms, orders, locks] = await Promise.all([
    getAll('shops'),
    getAll('merchants'),
    getAll('rooms'),
    getAll('orders'),
    getAll('locks')
  ]);
  return { shops, merchants, rooms, orders, locks };
}

function paginate(list, page, pageSize) {
  const currentPage = Math.max(Number(page) || 1, 1);
  const currentSize = Math.max(Number(pageSize) || 10, 1);
  const start = (currentPage - 1) * currentSize;
  return {
    list: list.slice(start, start + currentSize),
    total: list.length,
    page: currentPage,
    pageSize: currentSize
  };
}

function toMerchantRow(merchant, shop) {
  const expired = !!(shop && shop.expiresAt && shop.expiresAt < now());
  const effectiveStatus = expired
    ? 'disabled'
    : (normalizeStatus(merchant.status) === 'enabled' && shop && normalizeStatus(shop.status) === 'enabled'
      ? 'enabled'
      : normalizeStatus(merchant.status));
  return {
    merchantId: merchant.id,
    shopId: shop ? shop.id : merchant.shopId,
    account: merchant.account,
    managerName: merchant.managerName || '',
    phone: merchant.phone || '',
    status: effectiveStatus,
    merchantStatus: normalizeStatus(merchant.status),
    shopStatus: shop ? normalizeStatus(shop.status) : 'enabled',
    shopName: shop ? shop.name : '',
    address: shop ? shop.address : '',
    hours: shop ? shop.hours : { open: '', close: '' },
    paidMonths: shop ? Number(shop.paidMonths || 0) : 0,
    expiresAt: shop ? Number(shop.expiresAt || 0) : 0,
    qrCodeFileId: shop ? shop.qrCodeFileId || '' : '',
    qrCodeUpdatedAt: shop ? shop.qrCodeUpdatedAt || 0 : 0,
    createdAt: merchant.createdAt || 0,
    updatedAt: Math.max(merchant.updatedAt || 0, shop && shop.updatedAt || 0)
  };
}

function buildShopQrScene(shopId) {
  return `sid=${shopId}`;
}

async function ensureShopQrCode(shop) {
  try {
    let fileID = shop.qrCodeFileId || '';
    const scene = shop.qrCodeScene || buildShopQrScene(shop.id);

    if (!fileID) {
      const response = await cloud.openapi.wxacode.getUnlimited({
        scene,
        page: 'pages/home/index',
        checkPath: false
      });
      const upload = await cloud.uploadFile({
        cloudPath: `shop-qrcodes/${shop.id}.png`,
        fileContent: response.buffer
      });
      fileID = upload.fileID;
      const updatedAt = now();
      await db.collection('shops').doc(shop._id).update({
        data: {
          qrCodeFileId: fileID,
          qrCodeScene: scene,
          qrCodeUpdatedAt: updatedAt,
          updatedAt
        }
      });
      return {
        ...shop,
        qrCodeFileId: fileID,
        qrCodeScene: scene,
        qrCodeUpdatedAt: updatedAt,
        updatedAt
      };
    }

    return {
      ...shop,
      qrCodeScene: scene
    };
  } catch (error) {
    console.error('[admin-api] ensureShopQrCode failed:', error);
    const errCode = error && (error.errCode || error.code) ? String(error.errCode || error.code) : '';
    const errMsg = error && (error.errMsg || error.message) ? String(error.errMsg || error.message) : String(error || '');
    throw new Error(`二维码生成失败${errCode ? ` [${errCode}]` : ''}${errMsg ? `: ${errMsg}` : ''}`);
  }
}

async function getShopQrCodeByAdmin(data) {
  const merchantId = String(data.merchantId || '').trim();
  const shopId = String(data.shopId || '').trim();
  let shop = null;

  if (shopId) {
    const shopRes = await db.collection('shops').where({ id: shopId }).limit(1).get();
    shop = shopRes.data && shopRes.data.length ? shopRes.data[0] : null;
  } else if (merchantId) {
    const merchantRes = await db.collection('merchants').where({ id: merchantId }).limit(1).get();
    const merchant = merchantRes.data && merchantRes.data.length ? merchantRes.data[0] : null;
    if (!merchant) {
      return { ok: false, message: '商家不存在' };
    }
    const shopRes = await db.collection('shops').where({ id: merchant.shopId }).limit(1).get();
    shop = shopRes.data && shopRes.data.length ? shopRes.data[0] : null;
  }

  if (!shop) {
    return { ok: false, message: '门店不存在' };
  }

  const resolvedShop = await ensureShopQrCode(shop);
  const tempResult = await cloud.getTempFileURL({
    fileList: [resolvedShop.qrCodeFileId]
  });
  const tempFileURL = tempResult.fileList && tempResult.fileList.length
    ? tempResult.fileList[0].tempFileURL || ''
    : '';

  return {
    ok: true,
    shopId: resolvedShop.id,
    shopName: resolvedShop.name,
    fileID: resolvedShop.qrCodeFileId,
    tempFileURL,
    updatedAt: resolvedShop.qrCodeUpdatedAt || resolvedShop.updatedAt || 0
  };
}

async function adminLogin(data) {
  const res = await db.collection('admins').where({
    account: String(data.account || '').trim(),
    password: String(data.password || '').trim()
  }).limit(1).get();
  const admin = res.data && res.data.length ? res.data[0] : null;
  if (!admin || normalizeStatus(admin.status) !== 'enabled') {
    return { ok: false, message: '\u8d26\u53f7\u6216\u5bc6\u7801\u9519\u8bef' };
  }
  await db.collection('admins').doc(admin._id).update({
    data: {
      lastLoginAt: now(),
      updatedAt: now()
    }
  });
  return {
    ok: true,
    admin: {
      id: admin.id,
      account: admin.account,
      name: admin.name || admin.account
    }
  };
}

async function listMerchantsWithShops(data) {
  const snapshot = await getSnapshot();
  const keyword = String(data.keyword || '').trim().toLowerCase();
  const status = String(data.status || '').trim();
  const rows = snapshot.merchants
    .filter((merchant) => normalizeStatus(merchant.status) !== 'deleted')
    .map((merchant) => toMerchantRow(merchant, snapshot.shops.find((shop) => shop.id === merchant.shopId)))
    .filter((item) => {
      if (status && item.status !== status) return false;
      if (!keyword) return true;
      return [item.shopName, item.account, item.phone, item.managerName].some((value) => String(value || '').toLowerCase().includes(keyword));
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return { ok: true, ...paginate(rows, data.page, data.pageSize) };
}

async function getMerchantDetail(data) {
  const snapshot = await getSnapshot();
  const merchant = snapshot.merchants.find((item) => item.id === data.merchantId);
  if (!merchant) return { ok: false, message: '\u5546\u5bb6\u4e0d\u5b58\u5728' };
  const shop = snapshot.shops.find((item) => item.id === merchant.shopId);
  return {
    ok: true,
    merchant: toMerchantRow(merchant, shop),
    rooms: snapshot.rooms.filter((item) => item.shopId === merchant.shopId)
  };
}

async function createMerchantWithShop(data) {
  const account = String(data.account || '').trim();
  const password = String(data.password || '').trim();
  const shopName = String(data.shopName || '').trim();
  const address = String(data.address || '').trim();
  const managerName = String(data.managerName || '').trim();
  const phone = String(data.phone || '').trim();
  const open = String(data.hours && data.hours.open || '').trim();
  const close = String(data.hours && data.hours.close || '').trim();
  const paidMonths = Math.max(Number(data.paidMonths) || 0, 0);
  if (!account || !password || !shopName || !address || !managerName || !phone || !open || !close || !paidMonths) {
    return { ok: false, message: '\u8bf7\u5b8c\u6574\u586b\u5199\u5546\u5bb6\u4fe1\u606f' };
  }
  const existing = await db.collection('merchants').where({ account }).limit(1).get();
  if (existing.data && existing.data.length) {
    return { ok: false, message: '\u5546\u5bb6\u8d26\u53f7\u5df2\u5b58\u5728' };
  }
  const timestamp = now();
  const shopId = createId('shop');
  const merchantId = createId('merchant');
  await db.collection('shops').add({
    data: {
      id: shopId,
      name: shopName,
      address,
      hours: { open, close },
      notice: DEFAULT_NOTICE,
      status: 'enabled',
      paidMonths,
      expiresAt: addMonths(timestamp, paidMonths),
      createdAt: timestamp,
      updatedAt: timestamp
    }
  });
  await db.collection('merchants').add({
    data: {
      id: merchantId,
      shopId,
      account,
      password,
      managerName,
      phone,
      status: 'enabled',
      createdAt: timestamp,
      updatedAt: timestamp
    }
  });
  return getMerchantDetail({ merchantId });
}

async function updateMerchantWithShop(data) {
  const merchantRes = await db.collection('merchants').where({ id: data.merchantId }).limit(1).get();
  const merchant = merchantRes.data && merchantRes.data.length ? merchantRes.data[0] : null;
  if (!merchant) return { ok: false, message: '\u5546\u5bb6\u4e0d\u5b58\u5728' };
  const shopData = { updatedAt: now() };
  const merchantData = { updatedAt: now() };
  const renewMonths = Math.max(Number(data.paidMonths) || 0, 0);
  if (data.shopName) shopData.name = String(data.shopName).trim();
  if (data.address) shopData.address = String(data.address).trim();
  if (data.hours && data.hours.open && data.hours.close) {
    shopData.hours = { open: data.hours.open, close: data.hours.close };
  }
  if (data.managerName) merchantData.managerName = String(data.managerName).trim();
  if (data.phone) merchantData.phone = String(data.phone).trim();
  if (data.status) {
    const status = normalizeStatus(data.status);
    shopData.status = status;
    merchantData.status = status;
  }
  const shopRes = await db.collection('shops').where({ id: merchant.shopId }).limit(1).get();
  const shop = shopRes.data && shopRes.data.length ? shopRes.data[0] : null;
  if (shop && renewMonths > 0) {
    const baseTs = shop.expiresAt && shop.expiresAt > now() ? shop.expiresAt : now();
    shopData.expiresAt = addMonths(baseTs, renewMonths);
    shopData.paidMonths = Number(shop.paidMonths || 0) + renewMonths;
    shopData.status = 'enabled';
    merchantData.status = 'enabled';
  }
  await Promise.all([
    db.collection('shops').where({ id: merchant.shopId }).update({ data: shopData }),
    db.collection('merchants').where({ id: data.merchantId }).update({ data: merchantData })
  ]);
  return getMerchantDetail({ merchantId: data.merchantId });
}

async function resetMerchantPassword(data) {
  const password = String(data.password || '').trim();
  if (!password) return { ok: false, message: '\u8bf7\u8f93\u5165\u65b0\u5bc6\u7801' };
  await db.collection('merchants').where({ id: data.merchantId }).update({
    data: {
      password,
      updatedAt: now()
    }
  });
  return { ok: true };
}

async function toggleMerchantStatus(data) {
  const status = data.status === 'disabled' ? 'disabled' : 'enabled';
  const res = await db.collection('merchants').where({ id: data.merchantId }).limit(1).get();
  const merchant = res.data && res.data.length ? res.data[0] : null;
  if (!merchant) return { ok: false, message: '\u5546\u5bb6\u4e0d\u5b58\u5728' };
  await Promise.all([
    db.collection('merchants').where({ id: data.merchantId }).update({ data: { status, updatedAt: now() } }),
    db.collection('shops').where({ id: merchant.shopId }).update({ data: { status, updatedAt: now() } })
  ]);
  return { ok: true };
}

async function deleteMerchant(data) {
  const res = await db.collection('merchants').where({ id: data.merchantId }).limit(1).get();
  const merchant = res.data && res.data.length ? res.data[0] : null;
  if (!merchant) return { ok: false, message: '\u5546\u5bb6\u4e0d\u5b58\u5728' };
  const timestamp = now();
  await Promise.all([
    db.collection('merchants').where({ id: data.merchantId }).update({ data: { status: 'deleted', deletedAt: timestamp, updatedAt: timestamp } }),
    db.collection('shops').where({ id: merchant.shopId }).update({ data: { status: 'deleted', deletedAt: timestamp, updatedAt: timestamp } })
  ]);
  return { ok: true };
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

function canDeleteRoom(snapshot, roomId, shopId) {
  const current = now();
  const hasFutureOrders = snapshot.orders.some((item) => item.roomId === roomId && item.shopId === shopId && item.status !== 'cancelled' && item.endAt > current);
  const hasLocks = snapshot.locks.some((item) => item.roomId === roomId && item.shopId === shopId && item.endAt > current);
  return !hasFutureOrders && !hasLocks;
}

async function listRoomsByAdmin(data) {
  const snapshot = await getSnapshot();
  const keyword = String(data.keyword || '').trim().toLowerCase();
  const shopId = String(data.shopId || '').trim();
  const rows = snapshot.rooms
    .filter((room) => !shopId || room.shopId === shopId)
    .map((room) => {
      const shop = snapshot.shops.find((item) => item.id === room.shopId);
      const current = now();
      const blocks = getActiveBlocks(snapshot, room.shopId, room.id);
      const hasUsingBlock = blocks.some((item) => current >= item.startAt && current < item.endAt && (item.type === 'completed' || item.type === 'lock'));
      let status = '\u7a7a\u95f2';
      if (hasUsingBlock) status = '\u4f7f\u7528\u4e2d';
      else if (blocks.length) status = '\u5df2\u9884\u7ea6';
      return {
        id: room.id,
        shopId: room.shopId,
        shopName: shop ? shop.name : '',
        name: room.name,
        tableNo: room.tableNo,
        priceLabel: room.priceLabel,
        image: room.image || DEFAULT_ROOM_IMAGE,
        status,
        canDelete: canDeleteRoom(snapshot, room.id, room.shopId),
        createdAt: room.createdAt || 0
      };
    })
    .filter((item) => {
      if (!keyword) return true;
      return [item.shopName, item.name, item.tableNo].some((value) => String(value || '').toLowerCase().includes(keyword));
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return { ok: true, ...paginate(rows, data.page, data.pageSize) };
}

async function createRoomByAdmin(data) {
  await db.collection('rooms').add({
    data: {
      id: createId('room'),
      shopId: data.shopId,
      name: String(data.name || '').trim(),
      tableNo: String(data.tableNo || '').trim(),
      priceLabel: String(data.priceLabel || '').trim(),
      image: data.image || DEFAULT_ROOM_IMAGE,
      createdAt: now(),
      updatedAt: now()
    }
  });
  return { ok: true };
}

async function updateRoomByAdmin(data) {
  await db.collection('rooms').where({ id: data.roomId, shopId: data.shopId }).update({
    data: {
      name: String(data.name || '').trim(),
      tableNo: String(data.tableNo || '').trim(),
      priceLabel: String(data.priceLabel || '').trim(),
      image: data.image || DEFAULT_ROOM_IMAGE,
      updatedAt: now()
    }
  });
  return { ok: true };
}

async function deleteRoomByAdmin(data) {
  const snapshot = await getSnapshot();
  if (!canDeleteRoom(snapshot, data.roomId, data.shopId)) {
    return { ok: false, message: '\u8be5\u623f\u95f4\u5b58\u5728\u672a\u7ed3\u675f\u9884\u7ea6\u6216\u9501\u53f0\uff0c\u6682\u4e0d\u80fd\u5220\u9664' };
  }
  await db.collection('rooms').where({ id: data.roomId, shopId: data.shopId }).remove();
  return { ok: true };
}

function orderToView(order, room, shop) {
  const statusTextMap = {
    pending: '\u5f85\u6838\u9500',
    completed: '\u5df2\u6838\u9500',
    cancelled: '\u5df2\u53d6\u6d88'
  };
  return {
    id: order.id,
    shopId: order.shopId,
    shopName: shop ? shop.name : '',
    roomId: order.roomId,
    roomName: room ? `${room.name} ${room.tableNo}` : '',
    userName: order.userName || '\u533f\u540d\u5ba2\u6237',
    phone: order.phone || '',
    status: order.status,
    statusText: statusTextMap[order.status] || order.status,
    createdAt: order.createdAt,
    createdAtText: formatDateTime(order.createdAt),
    timeRangeText: `${formatDateTime(order.startAt)} - ${formatDateTime(order.endAt).slice(11)}`,
    source: order.source || 'user'
  };
}

async function listOrdersByAdmin(data) {
  const snapshot = await getSnapshot();
  const shopId = String(data.shopId || '').trim();
  const status = String(data.status || '').trim();
  const phoneSuffix = String(data.phoneSuffix || '').trim();
  const startDate = String(data.startDate || '').trim();
  const endDate = String(data.endDate || '').trim();
  const rows = snapshot.orders
    .filter((order) => {
      if (shopId && order.shopId !== shopId) return false;
      if (status && order.status !== status) return false;
      if (phoneSuffix && !String(order.phone || '').endsWith(phoneSuffix)) return false;
      const bookingDate = formatDateTime(order.startAt).slice(0, 10);
      if (startDate && bookingDate < startDate) return false;
      if (endDate && bookingDate > endDate) return false;
      return true;
    })
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((order) => orderToView(order, snapshot.rooms.find((room) => room.id === order.roomId), snapshot.shops.find((shop) => shop.id === order.shopId)));
  return { ok: true, ...paginate(rows, data.page, data.pageSize) };
}

async function getDashboardStats() {
  const snapshot = await getSnapshot();
  const today = formatDateTime(now()).slice(0, 10);
  return {
    ok: true,
    stats: {
      merchantTotal: snapshot.merchants.filter((item) => normalizeStatus(item.status) !== 'deleted').length,
      enabledMerchantTotal: snapshot.merchants.filter((item) => normalizeStatus(item.status) === 'enabled').length,
      roomTotal: snapshot.rooms.length,
      todayOrderTotal: snapshot.orders.filter((item) => formatDateTime(item.createdAt).slice(0, 10) === today).length,
      pendingOrderTotal: snapshot.orders.filter((item) => item.status === 'pending').length
    }
  };
}

exports.main = async (event) => {
  const { action, data = {} } = event || {};
  await ensureBaseData();

  if (action === 'adminLogin') return adminLogin(data);
  if (action === 'listMerchantsWithShops') return listMerchantsWithShops(data);
  if (action === 'getMerchantDetail') return getMerchantDetail(data);
  if (action === 'createMerchantWithShop') return createMerchantWithShop(data);
  if (action === 'updateMerchantWithShop') return updateMerchantWithShop(data);
  if (action === 'resetMerchantPassword') return resetMerchantPassword(data);
  if (action === 'toggleMerchantStatus') return toggleMerchantStatus(data);
  if (action === 'deleteMerchant') return deleteMerchant(data);
  if (action === 'getShopQrCodeByAdmin') return getShopQrCodeByAdmin(data);
  if (action === 'listRoomsByAdmin') return listRoomsByAdmin(data);
  if (action === 'createRoomByAdmin') return createRoomByAdmin(data);
  if (action === 'updateRoomByAdmin') return updateRoomByAdmin(data);
  if (action === 'deleteRoomByAdmin') return deleteRoomByAdmin(data);
  if (action === 'listOrdersByAdmin') return listOrdersByAdmin(data);
  if (action === 'getDashboardStats') return getDashboardStats();

  return {
    ok: false,
    message: `Unknown action: ${action || 'empty'}`
  };
};
