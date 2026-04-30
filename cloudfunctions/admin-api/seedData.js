const DEFAULT_NOTICE = '\u9884\u7ea6\u6210\u529f\u540e\u8bf7\u572830\u5206\u949f\u5185\u5230\u5e97\u6838\u9500\uff0c\u8d85\u65f6\u672a\u5230\u5e97\u7cfb\u7edf\u4f1a\u81ea\u52a8\u53d6\u6d88\u9884\u7ea6\u5e76\u91ca\u653e\u5bf9\u5e94\u65f6\u6bb5\u3002';
const DEFAULT_ROOM_IMAGE = '/images/default-goods-image.png';

function getSeedData() {
  const timestamp = Date.now();
  const defaultPaidMonths = 12;
  const defaultExpiresAt = new Date(timestamp);
  defaultExpiresAt.setMonth(defaultExpiresAt.getMonth() + defaultPaidMonths);
  return {
    shops: [
      {
        id: 'shop-a',
        name: '\u4e50\u95f2\u68cb\u724c\u4f1a\u6240',
        address: '\u4e0a\u6d77\u5e02\u6d66\u4e1c\u65b0\u533a\u4e91\u6865\u8def88\u53f73\u697c',
        hours: { open: '09:00', close: '23:30' },
        notice: DEFAULT_NOTICE,
        status: 'enabled',
        paidMonths: defaultPaidMonths,
        expiresAt: defaultExpiresAt.getTime(),
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: 'shop-b',
        name: '\u805a\u53cb\u68cb\u724c\u8336\u820d',
        address: '\u4e0a\u6d77\u5e02\u95f5\u884c\u533a\u4e03\u8398\u8def16\u53f72\u697c',
        hours: { open: '10:00', close: '23:30' },
        notice: DEFAULT_NOTICE,
        status: 'enabled',
        paidMonths: defaultPaidMonths,
        expiresAt: defaultExpiresAt.getTime(),
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    rooms: [
      { id: 'room-a1', shopId: 'shop-a', name: '\u89c2\u666f\u5305\u95f4', tableNo: 'A101', priceLabel: '\u53c2\u8003\u4ef7 98\u5143/\u5c0f\u65f6', image: DEFAULT_ROOM_IMAGE, createdAt: timestamp, updatedAt: timestamp },
      { id: 'room-a2', shopId: 'shop-a', name: '\u56db\u4eba\u8f7b\u4eab\u623f', tableNo: 'A202', priceLabel: '\u53c2\u8003\u4ef7 68\u5143/\u5c0f\u65f6', image: DEFAULT_ROOM_IMAGE, createdAt: timestamp, updatedAt: timestamp },
      { id: 'room-a3', shopId: 'shop-a', name: '\u5546\u52a1\u5bf9\u5c40\u5ba4', tableNo: 'A303', priceLabel: '\u53c2\u8003\u4ef7 88\u5143/\u5c0f\u65f6', image: DEFAULT_ROOM_IMAGE, createdAt: timestamp, updatedAt: timestamp },
      { id: 'room-b1', shopId: 'shop-b', name: '\u4e34\u7a97\u9759\u97f3\u623f', tableNo: 'B201', priceLabel: '\u53c2\u8003\u4ef7 78\u5143/\u5c0f\u65f6', image: DEFAULT_ROOM_IMAGE, createdAt: timestamp, updatedAt: timestamp },
      { id: 'room-b2', shopId: 'shop-b', name: '\u597d\u53cb\u5bf9\u6218\u5ba4', tableNo: 'B202', priceLabel: '\u53c2\u8003\u4ef7 58\u5143/\u5c0f\u65f6', image: DEFAULT_ROOM_IMAGE, createdAt: timestamp, updatedAt: timestamp }
    ],
    merchants: [
      { id: 'merchant-a', shopId: 'shop-a', account: 'shopa', password: '123456', managerName: '\u9648\u5e97\u957f', phone: '13800138000', status: 'enabled', createdAt: timestamp, updatedAt: timestamp },
      { id: 'merchant-b', shopId: 'shop-b', account: 'shopb', password: '123456', managerName: '\u5218\u5e97\u957f', phone: '13900139000', status: 'enabled', createdAt: timestamp, updatedAt: timestamp }
    ],
    admins: [
      { id: 'admin-root', account: 'admin', password: '123456', name: '\u8d85\u7ea7\u7ba1\u7406\u5458', status: 'enabled', createdAt: timestamp, updatedAt: timestamp }
    ],
    orders: [],
    locks: [],
    history: []
  };
}

module.exports = {
  DEFAULT_NOTICE,
  DEFAULT_ROOM_IMAGE,
  getSeedData
};
