const DEFAULT_NOTICE = '预约成功后请在30分钟内到店核验，超时未到店系统会自动取消预约并释放对应时段。';
const DEFAULT_ROOM_IMAGE = '/images/default-goods-image.png';
const DEFAULT_AVATAR = '/images/avatar.png';

function getSeedData() {
  return {
    shops: [
      {
        id: 'shop-a',
        name: '乐闲棋牌会所',
        address: '上海市浦东新区云桥路88号1楼',
        hours: { open: '09:00', close: '23:30' },
        notice: DEFAULT_NOTICE
      },
      {
        id: 'shop-b',
        name: '聚友棋牌茶舍',
        address: '上海市闵行区七莘路16号2楼',
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
    users: [
      { id: 'default-user', nickName: '微信用户', avatarUrl: DEFAULT_AVATAR, phone: '' }
    ],
    orders: [],
    locks: [],
    history: []
  };
}

module.exports = {
  getSeedData
};
