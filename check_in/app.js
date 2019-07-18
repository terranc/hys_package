/* rem */
// 基准大小
var baseSize = 32

var page=1;

var interval;
// 设置 rem 函数
function setRem() {
  // 当前页面宽度相对于 750 宽的缩放比例，可根据自己需要修改。
  var scale = document.documentElement.clientWidth / 750
  // 设置页面根节点字体大小
  document.documentElement.style.fontSize = baseSize * Math.min(scale, 2) + 'px'
}
// 初始化
setRem()
// 改变窗口大小时重新设置 rem
window.onresize = function() {
  setRem()
}

/* 预加载按钮图片 */
var images = [
  './img/button_bg@2x.png',
  './img/button_bg@3x.png',
  './img/button_open_bg@2x.png',
  './img/button_open_bg@3x.png',
  './img/button_open_side@2x.png',
  './img/button_open_side@3x.png'
]

for (var i = 0; i < images.length; i++) {
  var img = new Image()
  img.src = images[i]
}

// 时间段对应
// 本应在后端返回
var hourMap = {
  1: '08:30-09:00',
  2: '12:30-13:00',
  3: '19:30-20:00'
}

// 状态对应
var statusMap = {
  OFF: '未开始',
  ON: '未打卡',
  GOT: '已获取',
  MISSED: '错失'
}

// 补0
function addZero(i){
  if(i < 10){
    i = '0' + i
  }
  return i
}

// 样式状态
var styleMap = {
  OFF: 'not_start',
  ON: 'not_start',
  GOT: 'opened',
  MISSED: 'miss'
}

// safari 下时间格式问题
var _fixDate = function (str) {
  return str.replace('+0000', '')
}

var _dayjs = function (str) {
  return dayjs(_fixDate(str))
}


function getOffsetTime(_endtime) {
  var nowtime = _dayjs(_now).toDate()
  var endtime = _dayjs(_endtime).toDate()
  var lefttime = parseInt((endtime.getTime() - nowtime.getTime()) / 1000)
  var d = parseInt(lefttime / (24 * 60 * 60))
  var h = parseInt(lefttime / (60 * 60) % 24)
  var m = parseInt(lefttime / 60 % 60)
  var s = parseInt(lefttime % 60)
  h = addZero(h)
  m = addZero(m)
  s = addZero(s)
  return h + ':' + m + ':' + s
}

function getOffsetTime_(lefttime){
  var d = parseInt(lefttime / (24 * 60 * 60))
  var h = parseInt(lefttime / (60 * 60) % 24)
  var m = parseInt(lefttime / 60 % 60)
  var s = parseInt(lefttime % 60)
  h = addZero(h)
  m = addZero(m)
  s = addZero(s)
  return h + ':' + m + ':' + s
}

var processHistory = function (list) {
  list.forEach(function(_list){
    _list.checkInDateStr = _dayjs(_list.checkInDate).format('MM月DD日') + ' 周' + '日一二三四五六'.charAt(_dayjs(_list.checkInDate).toDate().getDay())
    _list.list.forEach(function(one) {
      one.checkInRoundStr = hourMap[one.checkInRound]
      one.statusStr = statusMap[one.state]
    })
  })
  return list
}

Vue.component('modal', {
  template:
    '<div class="modal-mask" @touchmove.prevent @click="$emit(\'on-click-mask\')"><div class="modal-wrapper"><slot></slot></div></div>'
})

var app = new Vue({
  el: '#app',
  created: function() {
    var _this = this
    wx.ready(function() {
      _this.setShare()
      // config信息验证后会执行ready方法，所有接口调用都必须在config接口获得结果之后，config是一个客户端的异步操作，所以如果需要在页面加载时就调用相关接口，则须把相关接口放在ready函数中调用来确保正确执行。对于用户触发时才调用的接口，则可以直接调用，不需要放在ready函数中。
    })
    var first = localStorage.getItem(LOCALSTORAGE_KEY)
    if (first) {
      this.getSignInfo()
    } else {
      this.firstModalVisible = true
      localStorage.setItem(LOCALSTORAGE_KEY, '1')
    }
    this.getBasicInfo()
    this.getHistory()
    this.setJssdkConfig()

    // 显示 confirm，在显示前可以修改 confirmTitile 和 confirmText
    /*
    setTimeout(function () {  // 用于直接测试效果
      _this.confirmModalVisible = true
    }, 2000)
    */
  },
  data: {
    isConfirm: false, // 是否为 confirm 弹窗
    confirmTitle: '操作提示',
    confirmText: '确定吗?',

	  styleMap: styleMap,
    upcomingTime: '', // 下次打卡开始时间
    offsetTime: '', // 倒计时
    targetTime: '', // 倒计时目标时间
    leftTime: 0, // 倒计时目标时间

    datetimeStr: '',
    ready: false,
    hasMore: true,

    /* 3个弹窗显示状态 */
    firstModalVisible: false, // 第一次进首页提示弹窗
    signModalVisible: false, // 打卡首页弹层
    finishModalVisible: false, // 没有条包了
    countdownModalVisible: false, // 未开始
    confirmModalVisible: false, // 确认弹窗
    
    firstSteps: STEPS,
    signInfoRaw: {
      datetime_str: '',
      money: 0
    },
    signInfo: {
      datetime_str: '',
      money: 0
    },
    // 因为接口只返回单个，多个已经弃用
    signInfos: [{
      money: 0
    }],
    user: {
      headimgurl: window.headimgurl || '',
      nickname: window.nickname || ''
    },
    summary: {
      gotTotalAmount: 0.00,
      numChecked: 0,
      numToCheck: 0
    },
    rules: RULES,
    history: []
  },
  methods: {
    onConfirm: function () {
      console.log('on confirm')
    },
    onCheckCountdownConfirm: function () {
      this.countdownModalVisible = false
    } ,
    getOffsetTime: function () {
      if(this.leftTime === 0){
    	  clearInterval(interval)
    	  this.countdownModalVisible = false;
    	  this.getSignInfo();
    	  this.getHistory();
      }
      this.leftTime--;
      this.offsetTime = getOffsetTime_(this.leftTime)
    },
    getSignInfo: function() {
      var _this = this
      /**
      * 0=正常，有打卡信息
      * 101=在活动期内，但没有打卡资格
      * 102=未在活动期内
      */
      axios.get('./mock/sign.json').then(function(res) {
      //axios.get('/checkIn/get').then(function(res) {
        var error = res.data.error
        // 进行中
        if (error === 0) {
          _this.signModalVisible = true
          _this.signInfoRaw = res.data.data.data
          _this.datetimeStr = res.data.data.checkInDate
        }
        // 未开始
        if (error === 102) {
          _this.countdownModalVisible = true
          _this.upcomingTime = hourMap[res.data.data.data.checkInRound]
          _this.targetTime = res.data.data.data.checkInDate
          var nowtime = _dayjs(res.data.data.data.now).toDate()
          var endtime = _dayjs(res.data.data.data.checkInDate).toDate()
          _this.leftTime= parseInt((endtime.getTime() - nowtime.getTime()) / 1000+1);
          _this.getOffsetTime()
          interval = setInterval(_this.getOffsetTime, 1000)
        }
        if (error === 101) {
          _this.finishModalVisible = true
        }
      })
    },
    getHistory: function() {
      var _this = this
      axios.get('./mock/history.json').then(function(res) {
      //axios.get('/checkIn/list/'+page).then(function(res) {
        _this.history = processHistory(res.data.data.list)
        _this.hasMore = res.data.data.has_more
      })
    },
    getBasicInfo: function() {
      var _this = this
      axios.get('./mock/user.json').then(function(res) {
      //axios.get('/checkIn/user').then(function(res) {
        var data = res.data.data
        _this.summary = data.summary
        _this.user = data.user
        _this.ready = true
      })
    },
    setJssdkConfig: function() {
      axios.get('./mock/jssdk.json').then(function(res) {
        wx.config(res.data.data)
      })
    },
    setShare: function() {
      wx.updateAppMessageShareData({
        title: '', // 分享标题
        desc: '', // 分享描述
        link: '', // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
        imgUrl: '', // 分享图标
        success: function() {
          // 设置成功
        }
      })
      wx.updateTimelineShareData({
        title: '', // 分享标题
        link: '', // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
        imgUrl: '', // 分享图标
        success: function() {
          // 设置成功
        }
      })
    },
    onLoadMoreTask: function() {
      var _this = this
      page++;
      axios.get('./mock/history.json').then(function(res) {
      //axios.get('/checkIn/list/'+page).then(function(res) {
        _this.history = _this.history.concat(processHistory(res.data.data.list))
        _this.hasMore = res.data.data.has_more
      })
    },
    onCheckMore: function() {
      location.href = DETAIL_URL
    },
    onOpenSignBar: function(item, index) {
      var _this = this
      item.isDisable = true;
      window.confetti({
        particleCount: 256,
        zIndex:9999
      })
      axios.get('./mock/open.json'+this.signInfoRaw.id).then(function(res) {
      //axios.post('/checkIn/open/'+this.signInfoRaw.id).then(function(res) {
    	 if (res.data.error === 0){
	        _this.signInfo.money = res.data.data.data.checkInAmount + "元"
	        _this.getBasicInfo();
	        _this.getHistory();
    	 } else {
    		 // alert(res.data.data.data.msg)
         this.isConfirm = false // alert 模式
         this.confirmText = res.data.data.data.msg // 修改显示内容
         this.confirmModalVisible = true // 显示弹窗
    	 }
      })
    },
    onShareToWechat: function() {},
    onCheckShop: function() {
      location.href = SHOP_URL
    }
  }
})
