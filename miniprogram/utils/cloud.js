const envConfig = require('../envList');

function getDefaultEnvId() {
  const envList = (envConfig && envConfig.envList) || [];
  if (!envList.length) {
    return '';
  }
  const first = envList[0];
  if (typeof first === 'string') {
    return first;
  }
  return first.envId || first.alias || '';
}

function canUseCloud() {
  return !!wx.cloud && !!getDefaultEnvId();
}

function initCloud() {
  if (!wx.cloud || !getDefaultEnvId()) {
    return {
      enabled: false,
      envId: ''
    };
  }

  wx.cloud.init({
    env: getDefaultEnvId(),
    traceUser: true
  });

  return {
    enabled: true,
    envId: getDefaultEnvId()
  };
}

async function callCloud(action, data = {}) {
  const { result } = await wx.cloud.callFunction({
    name: 'api',
    data: {
      action,
      data
    }
  });
  return result || {};
}

async function callFunction(name, data = {}) {
  const { result } = await wx.cloud.callFunction({
    name,
    data
  });
  return result || {};
}

module.exports = {
  callFunction,
  callCloud,
  canUseCloud,
  getDefaultEnvId,
  initCloud
};
