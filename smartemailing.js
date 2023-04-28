const fs = require('fs');
const path = require('path');
const axios = require('axios');
const axiosRetry = require('axios-retry');

const cfg = JSON.parse(fs.readFileSync(path.join('./api_config/api_config.json'), 'utf8'));
axiosRetry(axios, { retries: cfg.smartemailing.retries });
const api = axios.create({
  baseURL: cfg.smartemailing.api,
  timeout: cfg.smartemailing.timeout,
  auth: {
    username: cfg.smartemailing.username,
    password: cfg.smartemailing.usertoken
  }
});
axiosRetry(api, { retries: cfg.smartemailing.retries });

module.exports.createContactList = function(name, sendername, senderemail, replyto, publicname) {
  var contactlist = {
    name: name,
    sendername: sendername,
    senderemail: senderemail,
    replyto: replyto
  }
  if (publicname) {
    contactlist['publicname'] = publicname;
  }
  return new Promise(function(resolve, reject) {
    api.post('/contactlists', contactlist).then(function(res) {
      if (res.data.status === 'created') {
        resolve(res.data.status);
      } else {
        reject(response.data.message);
      }
    }).catch(function(err) {
      reject(err.response.data.message);
    });
  });
};

module.exports.contactPasswordUpdate = function (email, level, custom) {
    var passwordlist = cfg.smartemailing.passwordLists.map(list => {
        if (list === level) {
            return {
                id: level,
                status: 'confirmed'
            };
        }
        return {
            id: list,
            status: 'removed'
        };
    });
    return new Promise(function (resolve, reject) {
        api.post('/import', {
            settings: {
                update: custom === undefined || custom === null ? false : true
            },
            data: [
                {
                    emailaddress: email,
                    language: 'cz_CZ',
                    contactlists: passwordlist,
                    customfields: custom || []
                }
            ]
        }).then(function (res) {
            var r = {};
            if (res.data.status === 'created') {
                resolve(email);
            } else {
                reject(res.data.status);
            }
        }).catch(function (err) {
            reject(err);
        });
    });
};

module.exports.contactCreateOrUpdate = function(email, level, custom) {
  var contactlist = cfg.smartemailing.contactLists.map(list => {
      if (list === level) {
          return {
              id: level,
              status: 'confirmed'
          };
      }
      return {
          id: list,
          status: 'removed'
      };
  });
  return new Promise(function(resolve, reject) {
    api.post('/import', {
      settings: {
        update: custom === undefined || custom === null ? false : true
      },
      data: [
        {
          emailaddress: email,
          language: 'cz_CZ',
          contactlists: contactlist,
          customfields: custom || []
        }
      ]
    }).then(function(res) {
      var r = {};
      if (res.data.status === 'created') {
        resolve(email);
      } else {
        reject(res.data.status);
      }
    }).catch(function(err) {
      reject(err);
    });
  });
};

module.exports.creditCreateOrUpdate = function(email, uuid, level, custom) {
  var creditlist = cfg.smartemailing.creditLists.map(list => {
    if (list === level) {
      return {
        id: level,
        status: 'confirmed'
      };
    }
    return {
      id: list,
      status: 'removed'
    };
  });
  return new Promise(function(resolve, reject) {
    api.post('/import', {
      settings: {
        update: custom === undefined || custom === null ? false : true
      },
      data: [
        {
          emailaddress: email,
          language: 'cz_CZ',
          contactlists: creditlist,
          customfields: custom || []
        }
      ]
    }).then(function(res) {
      var r = {};
      if (res.data.status === 'created') {
        resolve(uuid);
      } else {
        reject(res.data.status);
      }
    }).catch(function(err) {
      reject(err);
    });
  });
};

