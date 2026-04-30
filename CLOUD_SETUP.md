# 云开发接入第一阶段

当前这一版已经做了云开发基础骨架，但还没有把全部业务完全迁到云数据库。

## 已完成

- 小程序启动时会尝试执行 `wx.cloud.init`
- 已新增统一云服务入口：
  - `miniprogram/utils/cloud.js`
  - `miniprogram/utils/service.js`
  - `miniprogram/utils/store.js`
- 已新增云函数目录：
  - `cloudfunctions/bootstrap`
  - `cloudfunctions/api`
- 已补充项目云函数根目录配置：
  - `miniprogram/project.config.json`

## 你现在要做的

1. 在 `miniprogram/envList.js` 里填写你的云开发环境 ID
2. 在微信开发者工具中右键上传并部署云函数：
   - `bootstrap`
   - `api`
3. 先执行一次 `bootstrap` 云函数
   - 作用：自动创建并写入初始集合和演示数据

## 会创建的集合

- `shops`
- `rooms`
- `merchants`
- `users`
- `orders`
- `locks`
- `history`

## 当前策略

这一阶段仍然保留本地 mock 兜底：

- 云环境未配置时：继续走本地 mock
- 云环境配置后：可以开始逐页把读写切到云函数

## 下一阶段建议

下一步优先迁移这些能力到云端：

1. 商家登录
2. 首页店铺/房间读取
3. 用户预约创建
4. 商家锁台、房间新增/修改/删除
5. 订单列表与核销

这样迁移风险最低，也最容易逐步验证。
