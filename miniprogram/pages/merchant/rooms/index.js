// pages/merchant/rooms/index.js
Page({
  data: {
    roomList: [],
    showAddModal: false,
    newRoomName: '',
    newRoomPrice: ''
  },

  onLoad() {
    // 复用首页的数据作为初始数据
    const pages = getCurrentPages();
    const homePage = pages.find(p => p.route === 'pages/home/index');
    if (homePage) {
      this.setData({ roomList: homePage.data.roomList.map(r => ({...r, status: '空闲'})) });
    }
  },

  showAddRoomModal() {
    this.setData({ showAddModal: true });
  },

  hideAddRoomModal() {
    this.setData({ showAddModal: false, newRoomName: '', newRoomPrice: '' });
  },

  addRoom() {
    // 添加新房间的逻辑
    this.hideAddRoomModal();
  },

  lockRoom(e) {
    // 线下锁定逻辑
  },

  editRoom(e) {
    // 编辑房间逻辑
  },

  deleteRoom(e) {
    // 删除房间逻辑
  }
});
