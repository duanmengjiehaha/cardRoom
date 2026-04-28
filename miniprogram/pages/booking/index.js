// pages/booking/index.js
Page({
  data: {
    shopName: '棋牌室示例店铺',
    roomName: '',
    timeSlots: [],
    selectedSlots: [],
    name: '',
    phone: ''
  },

  onLoad(options) {
    const roomName = `豪华包间 ${options.roomId || '未知'}`;
    const occupiedSlots = ['02:00', '02:30', '18:00', '18:30', '19:00'];

    this.setData({ roomName });
    this.generateTimeSlots(occupiedSlots);
  },

  generateTimeSlots(occupiedSlots) {
    const slots = [];
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    for (let i = 0; i < 24; i++) {
      for (let j = 0; j < 2; j++) {
        const hour = i < 10 ? `0${i}` : i;
        const minute = j === 0 ? '00' : '30';
        const time = `${hour}:${minute}`;
        
        let status = 'available';
        if (i < currentHour || (i === currentHour && (j === 0 ? 30 : 60) <= currentMinute + 30)) {
          status = 'past';
        }
        
        if (occupiedSlots.includes(time)) {
          status = 'occupied';
        }

        slots.push({ time, status });
      }
    }
    this.setData({ timeSlots: slots });
  },

  selectSlot(e) {
    const index = e.currentTarget.dataset.index;
    const { timeSlots } = this.data;
    const slot = timeSlots[index];

    if (slot.status === 'past' || slot.status === 'occupied') return;

    const newTimeSlots = [...timeSlots];
    const selectedIndex = this.data.selectedSlots.indexOf(slot.time);

    if (selectedIndex > -1) {
      this.data.selectedSlots.splice(selectedIndex, 1);
      newTimeSlots[index].status = 'available';
    } else {
      this.data.selectedSlots.push(slot.time);
      newTimeSlots[index].status = 'selected';
    }

    this.setData({ 
      timeSlots: newTimeSlots,
      selectedSlots: this.data.selectedSlots.sort()
    });
  },
  
  timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  },

  submitBooking() {
    const { selectedSlots, name, phone } = this.data;
    if (selectedSlots.length === 0) {
      wx.showToast({ title: '请选择预约时段', icon: 'none' });
      return;
    }
    if (!name) {
      wx.showToast({ title: '请填写姓名', icon: 'none' });
      return;
    }
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }

    const sortedSlots = [...selectedSlots].sort((a, b) => this.timeToMinutes(a) - this.timeToMinutes(b));
    for (let i = 0; i < sortedSlots.length - 1; i++) {
        const diff = this.timeToMinutes(sortedSlots[i+1]) - this.timeToMinutes(sortedSlots[i]);
        if (diff !== 30) {
            wx.showToast({ title: '请选择连续的时间段', icon: 'none' });
            return;
        }
    }

    function addMinutes(time, minutes) {
      const [h, m] = time.split(':').map(Number);
      const totalMinutes = h * 60 + m + minutes;
      const newH = Math.floor(totalMinutes / 60) % 24;
      const newM = totalMinutes % 60;
      return `${newH < 10 ? '0' + newH : newH}:${newM < 10 ? '0' + newM : newM}`;
    }

    const startTime = sortedSlots[0];
    const endTime = addMinutes(sortedSlots[sortedSlots.length - 1], 30);

    const order = {
      id: Date.now(),
      shopName: this.data.shopName,
      roomName: this.data.roomName,
      time: `${startTime}-${endTime}`,
      status: '待使用',
      statusColor: 'blue'
    };

    const orders = wx.getStorageSync('orders') || [];
    orders.unshift(order);
    wx.setStorageSync('orders', orders);

    wx.showToast({ title: '预约成功', icon: 'success' });

    setTimeout(() => {
      wx.navigateTo({ // 使用 navigateTo 以便可以返回
        url: '/pages/orders/index'
      });
    }, 1500);
  }
});
