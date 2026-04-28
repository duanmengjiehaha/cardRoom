// pages/home/index.js
Page({
  data: {
    shopInfo: {
      name: '棋牌室示例店铺',
      hours: '00:00 - 23:59',
      address: '示例地址 123号'
    },
    roomList: [
      {
        id: 1,
        name: '豪华包间 101',
        price: '¥98/小时',
        image: 'https://core-normal.traeapi.us/api/ide/v1/text_to_image?prompt=A%20photo%20of%20a%20modern%2C%20clean%2C%20and%20well-lit%20private%20room%20for%20playing%20board%20games%20or%20card%20games.%20The%20room%20contains%20a%20sturdy%20wooden%20table%20in%20the%20center%2C%20surrounded%20by%20comfortable%20chairs.%20On%20the%20table%2C%20there%20is%20a%20deck%20of%20cards%20and%20some%20game%20pieces%20neatly%20arranged.%20The%20walls%20are%20painted%20in%20a%20neutral%20color%2C%20and%20there%20are%20some%20framed%20pictures%20of%20famous%20card%20players%20or%20game-related%20art.%20The%20lighting%20is%20bright%20but%20not%20harsh%2C%20creating%20a%20cozy%20and%20inviting%20atmosphere.&image_size=landscape_4_3'
      },
      {
        id: 2,
        name: '标准四人桌 202',
        price: '¥68/小时',
        image: 'https://core-normal.traeapi.us/api/ide/v1/text_to_image?prompt=A%20photo%20of%20a%20standard%20four-person%20game%20table%20in%20a%20cozy%20corner%20of%20a%20room.%20The%20table%20is%20square%20and%20made%20of%20dark%20wood%2C%20with%20a%20green%20felt%20top.%20Four%20simple%20but%20comfortable%20chairs%20are%20placed%20around%20it.%20A%20single%20deck%20of%20playing%20cards%20is%20on%20the%20table.%20The%20background%20is%20softly%20out%20of%20focus%2C%20hinting%20at%20a%20larger%20game%20room.&image_size=landscape_4_3'
      },
      {
        id: 3,
        name: '窗边景观位 303',
        price: '¥78/小时',
        image: 'https://core-normal.traeapi.us/api/ide/v1/text_to_image?prompt=A%20photo%20of%20a%20game%20table%20set%20next%20to%20a%20large%20window%20with%20a%20view%20of%20a%20cityscape%20at%20dusk.%20The%20table%20is%20set%20for%20a%20card%20game.%20The%20room%20is%20dimly%20lit%20with%20warm%20light%2C%20and%20the%20city%20lights%20outside%20provide%20a%20beautiful%20backdrop.&image_size=landscape_4_3'
      }
    ]
  },
  
  onLoad() {
    
  },

  navigateToBooking(e) {
    const roomId = e.currentTarget.dataset.id;
    const shopInfo = this.data.shopInfo;
    // 保存或更新历史记录
    const history = wx.getStorageSync('shopHistory') || [];
    const existingIndex = history.findIndex(item => item.name === shopInfo.name);
    const newShop = {
      name: shopInfo.name,
      address: shopInfo.address,
      lastVisit: new Date().toLocaleString()
    };
    if (existingIndex > -1) {
      history.splice(existingIndex, 1);
    }
    history.unshift(newShop);
    wx.setStorageSync('shopHistory', history);

    // 跳转到预约页面
    wx.navigateTo({
      url: `/pages/booking/index?roomId=${roomId}`
    });
  }
});