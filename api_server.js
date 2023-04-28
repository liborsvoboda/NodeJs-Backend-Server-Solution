const fs = require('fs');
const path = require('path');
const fastify = require('fastify');
const cors = require('fastify-cors');
const compress = require('fastify-compress');
const helmet = require('fastify-helmet');
const reCAPTCHA = require('recaptcha2');
const moment = require('moment');
const fastJson = require('fast-json-stringify');
const axios = require('axios');
const Sequelize = require('sequelize');
const IndexHints = Sequelize.IndexHints;
const db = require('./api_models/api_db');
const email = require('./smartemailing');
const parser = require('fast-xml-parser');
const cfg = JSON.parse(fs.readFileSync(path.join('./api_config/api_config.json'), 'utf8'));
const schemas = JSON.parse(fs.readFileSync(path.join('./api_schemas/api_schemas.json'), 'utf8'));
const msg = JSON.parse(fs.readFileSync(path.join('./api_messages/api_messages.json'), 'utf8'));

const recaptcha = new reCAPTCHA({
  siteKey: cfg.recaptcha.key,
  secretKey: cfg.recaptcha.secret,
  ssl: true
});

const sequelize = new Sequelize(cfg.server.db.dbname, cfg.server.db.user, cfg.server.db.password, {
    host: cfg.server.db.host,
    dialect: cfg.server.db.type,
    logging: false,
    operatorsAliases: false,
    pool: {
        max: cfg.server.db.poolMax,
        min: cfg.server.db.poolMin,
        acquire: cfg.server.db.poolAcquire,
        idle: cfg.server.db.poolIdle
    },
    keepDefaultTimezone: true
});


const server = fastify({
    logger: false,
    http2: true,
    https: {
        key: fs.readFileSync(path.join(__dirname, cfg.server.ssl.key), 'utf8'),
        cert: fs.readFileSync(path.join(__dirname, cfg.server.ssl.cert), 'utf8')
    }
});

server.register(cors, {
  origin: true
});
server.register(compress);
server.register(helmet);

const httpsServer = fastify({
    logger: false,
    http2: false,
    https: {
        key: fs.readFileSync(path.join(__dirname, cfg.server.ssl.key), 'utf8'),
        cert: fs.readFileSync(path.join(__dirname, cfg.server.ssl.cert), 'utf8')
    }
});
httpsServer.register(cors, {
    origin: true
});
httpsServer.register(compress);
httpsServer.register(helmet);


server.get('/', { schema: schemas.hello }, (req, reply) => {
  reply.header('Content-Type', 'application/json').code(200);
  reply.send({ hello: 'world' });
});

server.post('/logout', { schema: schemas.auth, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        attributes: ['uuid'],
        required: true
      }]
    }).then(session => {
      if (!session) {
        return reply.send(msg.auth);
      }
      return db.Sessions.destroy({
        where: {
          session: req.body.session,
          ip: req.raw.connection.remoteAddress
        }
      }).then(rows => {
        if (rows < 1) {
          return reply.send(msg.db);
        }
        return reply.send(msg.logout);
      });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/auth_status', { schema: schemas.authStatus, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        attributes: ['isAdmin', 'deadtimeExpiration', 'groupId', 'uuid','abTestingAllowed'],
        required: true
      }]
    }).then(sessions => {
      if (!sessions.dataValues.user) {
        return reply.send(msg.auth);
      } else if (moment().unix() > sessions.dataValues.user.dataValues['deadtimeExpiration']) {
        return reply.send(msg.expired);
      }
      var r = msg.authStatus.ok;
      r['uuid'] = sessions.dataValues.user.dataValues['uuid'];
      r['isAdmin'] = sessions.dataValues.user.dataValues['isAdmin'];
      r['groupId'] = sessions.dataValues.user.dataValues['groupId'];
      r['abTestingAllowed'] = sessions.dataValues.user.dataValues['abTestingAllowed'];
      return reply.send(r);
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/get_profile', { schema: schemas.getProfile, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        required: true
      }]
    }).then(sessions => {
      if (!sessions.dataValues.user) {
        return reply.send(msg.auth);
      }
      sessions.dataValues.user.dataValues['result'] = 1
      sessions.dataValues.user.dataValues['Finished'] = sessions.dataValues.user.dataValues['StepProfileFinished'];
      return reply.send(sessions.dataValues.user.dataValues);
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});

server.post('/get_user_profile', { schema: schemas.getUserProfile, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        attributes: ['isAdmin','uuid'],
        required: true
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.privileges);
      }
      return db.Users.findOne({
        where: {
          uuid: sessions.dataValues.user.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.user.uuid
        }
      }).then(user => {
        user.dataValues['result'] = 1;
        user.dataValues['Finished'] = user.dataValues['StepProfileFinished'];
        return reply.send(user.dataValues);
      });
    }).catch(err => {
      console.log(err);
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/update_profile', { schema: schemas.updateProfile, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['uuid']
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.auth);
      }
      var update = {};
      if ('email' in req.body) {
        update['email'] = req.body.email;
      } else if ('password' in req.body) {
        update['password'] = req.body.password;
      }
      if ('Name' in req.body) {
        update['Name'] = req.body.Name;
      }
      if ('Surname' in req.body) {
        update['Surname'] = req.body.Surname;
      }
      if ('City' in req.body) {
        update['City'] = req.body.City;
      }
      if ('PostCode' in req.body) {
        update['PostCode'] = req.body.PostCode;
      }
      if ('StreetACP' in req.body) {
        update['StreetACP'] = req.body.StreetACP;
      }
      if ('Telephone' in req.body) {
        update['Telephone'] = req.body.Telephone;
      }
      if ('Company' in req.body) {
        update['Company'] = req.body.Company;
      }
      if ('Dic' in req.body) {
        update['Dic'] = req.body.Dic;
      }
      if ('Ico' in req.body) {
        update['Ico'] = req.body.Ico;
      }
      if ('Finished' in req.body) {
        update['StepProfileFinished'] = req.body.Finished;
      }
      if (Object.keys(update).length > 0) {
        return db.Users.update(update, {
          where: {
            uuid: sessions.dataValues.uuid
          },
          individualHooks: true
        }).then(profile => {
          if ('email' in req.body) {
            //send email
          } else if ('password' in req.body) {
            //send email
          }
          return reply.send(msg.update);
        });
      }
      return reply.send(msg.update);
    }).catch(err => {
      return reply.send('email' in err.fields ? msg.signup.email : msg.db);
    });
  }
  return reply.send(msg.auth);
});

server.post('/generateApi', { schema: schemas.generateApi, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['uuid'],
            include: [{
                model: db.Users,
                required: true,
                attributes: ['isAdmin']
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL generateUsersApiKey(:uuid)',
                {
                    replacements: {
                        uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.uuid
                    }
                }).then(apiKey => {
                    return reply.send({ result: 1, code: 'get-ok', apiKey: apiKey[0].apiKey });
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});

server.post('/update_user_profile', { schema: schemas.updateUserProfile, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['uuid'],
      include: [{
        model: db.Users,
        where: {
          isAdmin: true
        },
        required: true
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.privileges);
      }
      var update = {};
      if ('email' in req.body) {
        update['email'] = req.body.email;
      } else if ('password' in req.body) {
        update['password'] = req.body.password;
      }
      if ('Name' in req.body) {
        update['Name'] = req.body.Name;
      }
      if ('Surname' in req.body) {
        update['Surname'] = req.body.Surname;
      }
      if ('City' in req.body) {
        update['City'] = req.body.City;
      }
      if ('PostCode' in req.body) {
        update['PostCode'] = req.body.PostCode;
      }
      if ('StreetACP' in req.body) {
        update['StreetACP'] = req.body.StreetACP;
      }
      if ('Telephone' in req.body) {
        update['Telephone'] = req.body.Telephone;
      }
      if ('Company' in req.body) {
        update['Company'] = req.body.Company;
      }
      if ('Dic' in req.body) {
        update['Dic'] = req.body.Dic;
      }
      if ('Ico' in req.body) {
        update['Ico'] = req.body.Ico;
      }
      if ('Finished' in req.body) {
        update['StepProfileFinished'] = req.body.Finished;
      }
      if (Object.keys(update).length > 0) {
        return db.Users.update(update, {
          where: {
            uuid: req.body.uuid
          },
          individualHooks: true
        }).then(profile => {
          if ('email' in req.body) {
            //send email
          } else if ('password' in req.body) {
            //send email
          }
          return reply.send(msg.update);
        });
      }
      return reply.send(msg.update);
    }).catch(err => {
      return reply.send('email' in err.fields ? msg.signup.email : msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/check_pixel', { schema: schemas.checkPixel, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['uuid'],
      include: [{
        model: db.Users,
        attributes: ['isAdmin'],
        required: true
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.auth);
      }
      return db.Visits.findOne({
        where: {
          uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.uuid
        },
        raw: true
      }).then(checkPixel => {
        if (!checkPixel) {
          return reply.send({ result: 1, code: 'get-ok', message: 'No URLs', pixelExist: false});
        }
        return reply.send({ result: 1, code: 'get-ok', message: 'URLs loaded successfully', pixelExist: true});
      });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/get_domains', { schema: schemas.getDomains, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['uuid'],
      include: [{
        model: db.Users,
        attributes: ['isAdmin'],
        required: true
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.auth);
      }
      return db.UserDomains.findAll({
        where: {
          uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.uuid
        },
        attributes: ['domain', 'timestamp'],
        raw: true
      }).then(domainList => {
        if (!domainList) {
          return reply.send({ result: 1, code: 'get-ok', message: 'No URLs', domains: []});
        }
        var domains = domainList.map(function(domain) {
          return domain;
        });
        return reply.send({ result: 1, code: 'get-ok', message: 'URLs loaded successfully', domains: domains});
      });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/get_urls', { schema: schemas.getURLs, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['uuid'],
      include: [{
        model: db.Users,
        attributes: ['isAdmin'],
        required: true
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.auth);
      }
      return db.UserUrls.findAll({
        where: {
          uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.uuid
        },
        attributes: ['url'],
        raw: true
      }).then(urlsList => {
        if (!urlsList) {
          return reply.send({ result: 1, code: 'get-ok', message: 'No URLs', urls: []});
        }
        var urls = urlsList.map(function(urlList) {
          return urlList.url;
        });
        return reply.send({ result: 1, code: 'get-ok', message: 'URLs loaded successfully', urls: urls});
      });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/get_campaigns', { schema: schemas.getCampaigns, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['uuid'],
      include: [{
        model: db.Users,
        required: true,
        attributes: ['isAdmin']
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.auth);
      }
      return db.Campaigns.findAll({
        include: [{
          model: db.HeurekaApiKeys,
          required: true,
          attributes: ['Name','lastScore'],
          where: {
            uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.uuid
          },
          required: false
        },
        {
          model: db.ZboziApiKeys,
          required: true,
          attributes: ['Name'],
          where: {
            uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.uuid
          },
          required: false
        }
        ],
        where: {
          uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.uuid
          },
          order: [
              ['ActiveCampaign', 'DESC']
          ],
        raw: true,
          attributes: ['campaignID', 'ActiveCampaign', 'CampaignAdaptation', 'CampaignName', 'selectedDomain', 'heurekaAPIkey', 'zboziAPIkey', 'CaptureRuleObj', 'CapturedUrlsObjIn', 'CapturedUrlsObjOut', 'CaptureRuleReg', 'CapturedUrlsRegIn', 'CapturedUrlsRegOut', 'CaptureRuleStat', 'CapturedUrlsStatIn', 'CapturedUrlsStatOut', 'Heureka', 'Zbozi', 'LastEventsOrders', 'LastEventsRegistrations', 'SelectedNotifications', 'ShownRule', 'ShownUrlsIn', 'ShownUrlsOut', 'Statistics', 'VisitCount', 'OwnNotifyIcons', 'OwnNotify', 'selectedLanguage','ignoreDomain']
      }).then(campaigns => {
        if (!campaigns) {
          return reply.send({ result: 1, code: 'get-ok', message: 'No campaigns', campaigns: []});
        }
        var c = campaigns.map(function(campaign) {
          campaign.CampaignAdaptation = JSON.parse(campaign.CampaignAdaptation);
          campaign.CaptureRuleObj = JSON.parse(campaign.CaptureRuleObj);
          campaign.CapturedUrlsObjIn = JSON.parse(campaign.CapturedUrlsObjIn);
          campaign.CapturedUrlsObjOut = JSON.parse(campaign.CapturedUrlsObjOut);
          campaign.CaptureRuleReg = JSON.parse(campaign.CaptureRuleReg);
          campaign.CapturedUrlsRegIn = JSON.parse(campaign.CapturedUrlsRegIn);
          campaign.CapturedUrlsRegOut = JSON.parse(campaign.CapturedUrlsRegOut);
          campaign.CaptureRuleStat = JSON.parse(campaign.CaptureRuleStat);
          campaign.CapturedUrlsStatIn = JSON.parse(campaign.CapturedUrlsStatIn);
          campaign.CapturedUrlsStatOut = JSON.parse(campaign.CapturedUrlsStatOut);
          campaign.Heureka = JSON.parse(campaign.Heureka);
          campaign.Zbozi = JSON.parse(campaign.Zbozi);
          campaign.LastEventsOrders = JSON.parse(campaign.LastEventsOrders);
          campaign.LastEventsRegistrations = JSON.parse(campaign.LastEventsRegistrations);
          campaign.SelectedNotifications = JSON.parse(campaign.SelectedNotifications);
          campaign.ShownRule = JSON.parse(campaign.ShownRule);
          campaign.ShownUrlsIn = JSON.parse(campaign.ShownUrlsIn);
          campaign.ShownUrlsOut = JSON.parse(campaign.ShownUrlsOut);
          campaign.Statistics = JSON.parse(campaign.Statistics);
          campaign.VisitCount = JSON.parse(campaign.VisitCount);
          campaign.OwnNotify = JSON.parse(campaign.OwnNotify);
          campaign.OwnNotifyIcons = JSON.parse(campaign.OwnNotifyIcons);
          campaign.heurekaAPIkeyName = campaign['heurekaapikey.Name'];
          campaign.heurekaLastScore = campaign['heurekaapikey.lastScore'];
          campaign.zboziAPIkeyName = campaign['zboziapikey.Name'];
          return campaign;
        });
        return reply.send({ result: 1, code: 'get-ok', message: 'Campaigns loaded successfully', campaigns: c});
      });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/getAbTests', { schema: schemas.getAbTests, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['uuid'],
            include: [{
                model: db.Users,
                required: true,
                attributes: ['isAdmin']
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.auth);
            }
            return db.AbTesting.findAll({
                where: {
                    uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.uuid
                },
                order: [
                    ['id', 'DESC']
                ],
                include: [{
                    model: db.SharedvisitorsAB,
                    required: false,
                    attributes: []
                }],
                raw: true,
                attributes: ['id', 'active', 'activateNow', 'name', 'selectedDomain', 'targetUrlsNames', 'targetUrls', 'selectedCampaignIds', 'campaignDeactivate','targetParamIgnore', 'campaignRatio', 'startDateTime', 'endDateTime', 'dayCount', 'sendEmail', 'emailAddress', 'emailAddresses'
                    , [Sequelize.fn("COUNT", Sequelize.col("sharedvisitorsABs.id")), "dataExists"]
                ],
                group: ['id']
            }).then(abtestings => {
                if (!abtestings) {
                    return reply.send({ result: 1, code: 'get-ok', message: 'No Ab Testing', abtesting: [] });
                }
                var a = abtestings.map(function (abtesting) {
                    abtesting.targetUrlsNames = JSON.parse(abtesting.targetUrlsNames);
                    abtesting.targetUrls = JSON.parse(abtesting.targetUrls);
                    abtesting.selectedCampaignIds = JSON.parse(abtesting.selectedCampaignIds);
                    abtesting.campaignDeactivate = JSON.parse(abtesting.campaignDeactivate);
                    abtesting.targetParamIgnore = JSON.parse(abtesting.targetParamIgnore);
                    abtesting.campaignRatio = JSON.parse(abtesting.campaignRatio);
                    return abtesting;
                });
                return reply.send({ result: 1, code: 'get-ok', message: 'AB Tests loaded successfully', abtesting: a });
            });
        }).catch(err => {
                console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/deleteAbTest', { schema: schemas.deleteAbTest, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['uuid'],
            include: [{
                model: db.Users,
                required: true,
                attributes: ['isAdmin']
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.auth);
            }
            return db.AbTesting.destroy({
                where: {
                    uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.uuid,
                    id: req.body.id
                }
            }).then(rows => {
                if (rows < 1) {
                    return reply.send(msg.db);
                }
                return reply.send(msg.delete);
            });
        }).catch(err => {
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/updateAbTest', { schema: schemas.updateAbTest, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['uuid'],
            include: [{
                model: db.Users,
                required: true,
                attributes: ['isAdmin']
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.auth);
            }
            var update = {};
            if ('active' in req.body) {
                update['active'] = req.body.active;
            }
            if ('activateNow' in req.body) {
                update['activateNow'] = req.body.activateNow;
            }
            if ('name' in req.body) {
                update['name'] = req.body.name;
            }
            if ('selectedDomain' in req.body) {
                update['selectedDomain'] = req.body.selectedDomain;
            }
            if ('targetUrlsNames' in req.body) {
                const updateSchema = fastJson(schemas.updateAbTest.body.properties.targetUrlsNames);
                update['targetUrlsNames'] = updateSchema(req.body.targetUrlsNames);
            }
            if ('targetUrls' in req.body) {
                const updateSchema = fastJson(schemas.updateAbTest.body.properties.targetUrls);
                update['targetUrls'] = updateSchema(req.body.targetUrls);
            }
            if ('selectedCampaignIds' in req.body) {
                const updateSchema = fastJson(schemas.updateAbTest.body.properties.selectedCampaignIds);
                update['selectedCampaignIds'] = updateSchema(req.body.selectedCampaignIds);
            }
            if ('campaignDeactivate' in req.body) {
                const updateSchema = fastJson(schemas.updateAbTest.body.properties.campaignDeactivate);
                update['campaignDeactivate'] = updateSchema(req.body.campaignDeactivate);
            }
            if ('targetParamIgnore' in req.body) {
                const updateSchema = fastJson(schemas.updateAbTest.body.properties.targetParamIgnore);
                update['targetParamIgnore'] = updateSchema(req.body.targetParamIgnore);
            }
            if ('campaignRatio' in req.body) {
                const updateSchema = fastJson(schemas.updateAbTest.body.properties.campaignRatio);
                update['campaignRatio'] = updateSchema(req.body.campaignRatio);
            }
            if ('startDateTime' in req.body) {
                if (req.body.startDateTime.length > 0) { update['startDateTime'] = req.body.startDateTime;}
            }
            if ('endDateTime' in req.body) {
                if (req.body.endDateTime.length > 0) { update['endDateTime'] = req.body.endDateTime; }
            }
            if ('dayCount' in req.body) {
                update['dayCount'] = req.body.dayCount;
            }
            if ('sendEmail' in req.body) {
                update['sendEmail'] = req.body.sendEmail;
            }
            if ('emailAddress' in req.body) {
                update['emailAddress'] = req.body.emailAddress;
            }
            if ('emailAddresses' in req.body) {
                update['emailAddresses'] = req.body.emailAddresses;
            }

            if (Object.keys(update).length > 0) {
                update['uuid'] = sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.uuid;
                if (req.body.id == 0) {
                    return db.AbTesting.create(update).then(abtest => {

                        return reply.send(msg.created);
                    }).catch(err => {
                        console.log(err);
                        return reply.send(msg.db);
                    });
                } else {
                    return db.AbTesting.update(update, {
                        where: {
                            uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.uuid,
                            id: req.body.id
                        }
                    }).then(abtest => {
                        return reply.send(msg.update);
                    }).catch(err => {
                        console.log(err);
                        return reply.send(msg.db);
                    });
                }
            }
            return reply.send(msg.update);
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/getABVisitors', { schema: schemas.getABVisitors, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['uuid'],
            include: [{
                model: db.Users,
                required: true,
                attributes: ['isAdmin']
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL getABVisitors(:uuid,:abTestId,:type,:measureDay,:target,:targetParamIgnore)',
                {
                    replacements: {
                        uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.uuid,
                        abTestId: req.body.abTestId,
                        type: req.body.type,
                        measureDay: req.body.measureDay,
                        target: req.body.target,
                        targetParamIgnore: req.body.targetParamIgnore
                    }
                }).then(visitors => {
                    return reply.send({ result: 1, code: 'get-ok', visitors: visitors });
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/getABTable', { schema: schemas.getABTable, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['uuid'],
            include: [{
                model: db.Users,
                required: true,
                attributes: ['isAdmin']
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL getABTable(:uuid,:abTestId,:measureDay)',
                {
                    replacements: {
                        uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.uuid,
                        abTestId: req.body.abTestId,
                        measureDay: req.body.measureDay
                    }
                }).then(abTable => {
                    return reply.send({ result: 1, code: 'get-ok', abTable: abTable });
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});

server.post('/getLastUpdate', { schema: schemas.getLastUpdate, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['uuid'],
            include: [{
                model: db.Users,
                required: true,
                attributes: ['isAdmin']
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return sequelize.query('CALL getLastUpdate()'
               ).then(lastUpdate => {
                   return reply.send({ result: 1, code: 'get-ok', type: lastUpdate[0].type, timestamp: lastUpdate[0].timestamp });
                });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});

server.post('/update_campaigns', { schema: schemas.updateCampaigns, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['uuid'],
      include: [{
        model: db.Users,
        required: true,
        attributes: ['isAdmin']
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.auth);
      }
      var update = {};
      if ('ActiveCampaign' in req.body) {
        update['ActiveCampaign'] = req.body.ActiveCampaign;
      }
      if ('CampaignAdaptation' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.CampaignAdaptation);
        update['CampaignAdaptation'] = updateSchema(req.body.CampaignAdaptation);
      }
      if ('CampaignName' in req.body) {
        update['CampaignName'] = req.body.CampaignName;
      }
      if ('selectedDomain' in req.body) {
        update['selectedDomain'] = req.body.selectedDomain;
      }
      if ('heurekaAPIkey' in req.body) {
        update['heurekaAPIkey'] = req.body.heurekaAPIkey;
      }
      if ('zboziAPIkey' in req.body) {
        update['zboziAPIkey'] = req.body.zboziAPIkey;
      }
      if ('CaptureRuleObj' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.CaptureRuleObj);
        update['CaptureRuleObj'] = updateSchema(req.body.CaptureRuleObj);
      }
      if ('CapturedUrlsObjIn' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.CapturedUrlsObjIn);
        update['CapturedUrlsObjIn'] = updateSchema(req.body.CapturedUrlsObjIn);
      }
      if ('CapturedUrlsObjOut' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.CapturedUrlsObjOut);
        update['CapturedUrlsObjOut'] = updateSchema(req.body.CapturedUrlsObjOut);
      }

      if ('CaptureRuleReg' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.CaptureRuleReg);
        update['CaptureRuleReg'] = updateSchema(req.body.CaptureRuleReg);
      }
      if ('CapturedUrlsRegIn' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.CapturedUrlsRegIn);
        update['CapturedUrlsRegIn'] = updateSchema(req.body.CapturedUrlsRegIn);
      }
      if ('CapturedUrlsRegOut' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.CapturedUrlsRegOut);
        update['CapturedUrlsRegOut'] = updateSchema(req.body.CapturedUrlsRegOut);
      }
      if ('CaptureRuleStat' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.CaptureRuleStat);
        update['CaptureRuleStat'] = updateSchema(req.body.CaptureRuleStat);
      }
      if ('CapturedUrlsStatIn' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.CapturedUrlsStatIn);
        update['CapturedUrlsStatIn'] = updateSchema(req.body.CapturedUrlsStatIn);
      }
      if ('CapturedUrlsStatOut' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.CapturedUrlsStatOut);
        update['CapturedUrlsStatOut'] = updateSchema(req.body.CapturedUrlsStatOut);
      }
      if ('Heureka' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.Heureka);
        update['Heureka'] = updateSchema(req.body.Heureka);
      }
      if ('Zbozi' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.Zbozi);
        update['Zbozi'] = updateSchema(req.body.Zbozi);
      }
      if ('LastEventsOrders' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.LastEventsOrders);
        update['LastEventsOrders'] = updateSchema(req.body.LastEventsOrders);
      }
      if ('LastEventsRegistrations' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.LastEventsRegistrations);
        update['LastEventsRegistrations'] = updateSchema(req.body.LastEventsRegistrations);
      }
      if ('SelectedNotifications' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.SelectedNotifications);
        update['SelectedNotifications'] = updateSchema(req.body.SelectedNotifications);
      }
      if ('ShownRule' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.ShownRule);
        update['ShownRule'] = updateSchema(req.body.ShownRule);
      }
      if ('ShownUrlsIn' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.ShownUrlsIn);
        update['ShownUrlsIn'] = updateSchema(req.body.ShownUrlsIn);
      }
      if ('ShownUrlsOut' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.ShownUrlsOut);
        update['ShownUrlsOut'] = updateSchema(req.body.ShownUrlsOut);
      }
      if ('Statistics' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.Statistics);
        update['Statistics'] = updateSchema(req.body.Statistics);
      }
      if ('VisitCount' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.VisitCount);
        update['VisitCount'] = updateSchema(req.body.VisitCount);
      }
      if ('OwnNotify' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.OwnNotify);
        update['OwnNotify'] = updateSchema(req.body.OwnNotify);
      }
      if ('OwnNotifyIcons' in req.body) {
        const updateSchema = fastJson(schemas.updateCampaigns.body.properties.OwnNotifyIcons);
        update['OwnNotifyIcons'] = updateSchema(req.body.OwnNotifyIcons);
      }
      if ('selectedLanguage' in req.body) {
        update['selectedLanguage'] = req.body.selectedLanguage;
      }
      if ('ignoreDomain' in req.body) {
        update['ignoreDomain'] = req.body.ignoreDomain;
      }

      if (Object.keys(update).length > 0) {
        update['uuid'] = sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.uuid;
        if (!('campaignID' in req.body)) {
          return db.Campaigns.create(update).then(campaign => {
            return reply.send(msg.update);
          });
        } else {
          return db.Campaigns.update(update, {
            where: {
              uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.uuid,
              campaignID: req.body.campaignID
            }
          }).then(campaign => {
            return reply.send(msg.update);
          });
        }
      }
      return reply.send(msg.update);
    }).catch(err => {
console.log(err);
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/delete_campaigns', { schema: schemas.deleteCampaigns, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['uuid'],
      include: [{
        model: db.Users,
        required: true,
        attributes: ['isAdmin']
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.auth);
      }
      return db.Campaigns.destroy({
        where: {
          uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.uuid,
          campaignID: req.body.campaignID
        }
      }).then(rows => {
        if (rows < 1) {
          return reply.send(msg.db);
        }
        return reply.send(msg.delete);
      });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/checkapikeyheureka', { schema: schemas.checkApiKeyHeureka, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
      return db.Sessions.findOne({
          where: {
              session: req.body.session,
              ip: req.raw.connection.remoteAddress
          },
          attributes: ['uuid'],
          include: [{
              model: db.Users,
              required: true,
              attributes: ['isAdmin']
          }]
      }).then(sessions => {
          if (!sessions) {
              return reply.send(msg.auth);
          }
          var reviewsURL = '';
          if (req.body.country == 'SK') { reviewsURL = new URL(cfg.heurekaSK); } else { reviewsURL = new URL(cfg.heurekaCZ); }
          reviewsURL.searchParams.set('key', req.body.heurekaAPIkey);
          axios.get(reviewsURL.href).then(response => {
              var results = [];
              var reviews = parser.parse(response.data)['reviews']['review'];
              if (reviews.length == undefined) {
                  if ('unix_timestamp' in reviews && 'total_rating' in reviews) {
                      var r = {
                          apiKey: req.body.heurekaAPIkey,
                          timestamp: reviews['unix_timestamp'],
                          rating: reviews['total_rating'],
                      };
                      if ('summary' in reviews) {
                          r['summary'] = reviews['summary'].substr(0, 4000);
                      }
                      if ('pros' in reviews) {
                          r['pros'] = reviews['pros'].substr(0, 4000);
                      }
                      if ('pros' in r || 'summary' in r) {
                          results.push(r);
                      }
                  }

              } else {
                  for (var review in reviews) {
                      if ('unix_timestamp' in reviews[review] && 'total_rating' in reviews[review]) {
                          var r = {
                              apiKey: req.body.heurekaAPIkey,
                              timestamp: reviews[review]['unix_timestamp'],
                              rating: reviews[review]['total_rating'],
                          };
                          if ('summary' in reviews[review]) {
                              r['summary'] = reviews[review]['summary'].substr(0, 4000);
                          }
                          if ('pros' in reviews[review]) {
                              r['pros'] = reviews[review]['pros'].substr(0, 4000);
                          }
                          if ('pros' in r || 'summary' in r) {
                              results.push(r);
                          }
                      }
                  }
                    results.sort(function (a, b) {
                        if (a.timestamp < b.timestamp) {
                            return -1;
                        }
                        if (a.timestamp > b.timestamp) {
                            return 1;
                        }
                        return 0;
                    });
              }
              return reply.send({ result: 1, message: results });
          }).catch(err => {
              //console.log("response fail",err);
              return reply.send(msg.db);
          });
      }).catch(err => {
          //console.log("user_fail",err);
          return reply.send(msg.db);
    });
  }
  //console.log("session fail");
  return reply.send(msg.auth);
});
server.post('/checkapikeyzbozi', { schema: schemas.checkApiKeyZbozi, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['uuid'],
      include: [{
        model: db.Users,
        required: true,
        attributes: ['isAdmin']
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.auth);
      }
      var zboziApiCheck = axios.create({
        baseURL: cfg.zbozi.api+'?limit='+cfg.zbozi.limit,
        timeout: cfg.zbozi.timeout,
        auth: {
          username: req.body.idprovozovny,
          password: req.body.zboziapikey
        }
      });
      zboziApiCheck.get().then(response => {
        if (response.status === 200) {
          var results = [];
          var reviews = response.data.data;
          for (var review in reviews) {
            var r = {
              apiKey: req.body.zboziapikey,
              timestamp: response.data.data[review].createTimestamp,
              rating: response.data.data[review].ratingStars,
              positiveComments: response.data.data[review].positiveComments.substr(0, 4000),
              productName: unescape(response.data.data[review].productData.cartProductName.replace(/&quot;/g, '"')).substr(0, 2000)
            };
            if (r.productName !== null || r.positiveComments !== null) {
              results.push(r);
            }
          }
          results.sort(function(a, b) {
            if (a.timestamp < b.timestamp) {
              return -1;
            }
            if (a.timestamp > b.timestamp) {
              return 1;
            }
            return 0;
          });
          //founded products                    
          if (results.length > 0){
            return reply.send({ result: 1, message: results});
          } else {
            setTimeout (()=>{checkZboziShop(req.body.idprovozovny, req.body.zboziapikey).then(shopResponse => {
                if (shopResponse){
                  return reply.send({ result: 1, message: shopResponse });
                } else {
                  return reply.send(msg.db);
                }
              });
            },2000);
          }
        } else { //no product exist
          setTimeout (()=>{checkZboziShop(req.body.idprovozovny, req.body.zboziapikey).then(shopResponse => {
              if (shopResponse){
                return reply.send({ result: 1, message: shopResponse });
              } else {
                return reply.send(msg.db);
              }
            });
          },2000);
        }
      }).catch(function(err) {
        setTimeout (()=>{checkZboziShop(req.body.idprovozovny, req.body.zboziapikey).then(shopResponse => {
            if (shopResponse){
              return reply.send({ result: 1, message: shopResponse });
            } else {
              return reply.send(msg.db);
            }
          });
        },2000);
      });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }   
  return reply.send(msg.auth);
});

function checkZboziShop(idProvozovny, apiKey){
  zboziapishop = axios.create({
    baseURL: cfg.zbozi.apiShop+'?limit='+cfg.zbozi.limitShop,
    timeout: cfg.zbozi.timeout,
    auth: {
      username: idProvozovny,
      password: apiKey
    }
  });
  return zboziapishop.get().then(response => {
    if (response.status === 200) {
      var shopResult = [];
      var shopReviews = response.data.data;
      for (var shopReview in shopReviews ) {
        var r = {
          apiKey: apiKey,
          timestamp: response.data.data[shopReview ].createTimestamp,
          rating: null,
          productName: null,
          positiveComments: (response.data.data[shopReview].positiveComment === undefined)?null:(response.data.data[shopReview].positiveComment === '')?null:response.data.data[shopReview].positiveComment.substr(0, 4000)
        };
        if (r.positiveComments != null) {
          shopResult.push(r);
        }
      }
      shopResult.sort(function(a, b) {
        if (a.timestamp < b.timestamp) {
          return -1;
        }
        if (a.timestamp > b.timestamp) {
          return 1;
        }
        return 0;
      });
      if (shopResult){
        return shopResult;
      } else {
        return 0;
      }
    } else {
      return 0;
    }
  }).catch(function(err) {
    return 0;
  });
 return 0;
}

server.post('/delete_apikeyheureka', { schema: schemas.deleteApiKeyHeureka, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['uuid'],
      include: [{
        model: db.Users,
        required: true,
        attributes: ['isAdmin']
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.auth);
      }
      return db.HeurekaApiKeys.destroy({
        where: {
          uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.uuid,
          heurekaAPIkey: req.body.heurekaAPIkey
        }
      }).then(rows => {
        if (rows < 1) {
          return reply.send(msg.db);
        }
        return reply.send(msg.delete);
      });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/delete_apikeyzbozi', { schema: schemas.deleteApiKeyZbozi, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['uuid'],
      include: [{
        model: db.Users,
        required: true,
        attributes: ['isAdmin']
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.auth);
      }
      return db.ZboziApiKeys.destroy({
        where: {
          uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.uuid,
          zboziAPIkey: req.body.zboziAPIkey
        }
      }).then(rows => {
        if (rows < 1) {
          return reply.send(msg.db);
        }
        return reply.send(msg.delete);
      });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/get_heureka', { schema: schemas.getHeureka, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        required: true,
        attributes: ['Level', 'heurekaAPIkey', 'StepHeurekaFinished']
      }]
    }).then(sessions => {
      if (!sessions.dataValues.user) {
        return reply.send(msg.auth);
      }
      return reply.send({ result: 1, apiKey: sessions.dataValues.user.dataValues.heurekaAPIkey, Level: sessions.dataValues.user.dataValues.Level, Finished: sessions.dataValues.user.dataValues.StepHeurekaFinished });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/get_user_heureka', { schema: schemas.getUserHeureka, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        required: true,
        attributes: ['isAdmin','uuid']
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.privileges);
      }
      return db.Users.findOne({
        where: {
          uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid
        },
        attributes: ['Level', 'heurekaAPIkey', 'StepHeurekaFinished']
      }).then(user => {
        return reply.send({ result: 1, apiKey: user.dataValues.heurekaAPIkey, Level: user.dataValues.Level, Finished: user.dataValues.StepHeurekaFinished });
      });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/get_user_zbozi', { schema: schemas.getUserZbozi, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        required: true,
        attributes: ['isAdmin','uuid']
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.privileges);
      }
      return db.Users.findOne({
        where: {
          uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid
        },
        attributes: ['Level', 'StepZboziFinished']
      }).then(user => {
        return reply.send({ result: 1, Level: user.dataValues.Level, Finished: user.dataValues.StepZboziFinished });
      });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/update_heureka', { schema: schemas.updateHeureka, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['uuid']
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.auth);
      }
      var update = {};
      if ('apiKey' in req.body) {
        update['heurekaAPIkey'] = req.body.apiKey;
      }
      if ('Finished' in req.body) {
        update['StepHeurekaFinished'] = req.body.Finished;
      }
      if ('Level' in req.body) {
        update['Level'] = req.body.Level;
      }
      if ('SmartRegComplete' in req.body) {
        update['SmartRegComplete'] = req.body.SmartRegComplete;
      }
      if ('SmartStamp' in req.body) {
        update['SmartStamp'] = req.body.SmartStamp;
      }
      if (Object.keys(update).length > 0) {
        return db.Users.update(update, {
          where: {
            uuid: sessions.dataValues.uuid
          }
        }).then(heureka => {
          return reply.send(msg.update);
        });
      }
      return reply.send(msg.update);
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/update_user_heureka', { schema: schemas.updateUserHeureka, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['uuid'],
      include: [{
        model: db.Users,
        required: true,
        attributes: ['isAdmin','uuid']
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.privileges);
      }
      var update = {};
      if ('apiKey' in req.body) {
        update['heurekaAPIkey'] = req.body.apiKey;
      }
      if ('Finished' in req.body) {
        update['StepHeurekaFinished'] = req.body.Finished;
      }
      if ('Level' in req.body) {
        update['Level'] = req.body.Level;
      }
      if ('SmartRegComplete' in req.body) {
        update['SmartRegComplete'] = req.body.SmartRegComplete;
      }
      if ('SmartStamp' in req.body) {
        update['SmartStamp'] = req.body.SmartStamp;
      }
      if (Object.keys(update).length > 0) {
        return db.Users.update(update, {
          where: {
            uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid
          }
        }).then(heureka => {
          return reply.send(msg.update);
        });
      }
      return reply.send(msg.update);
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/update_user_zbozi', { schema: schemas.updateUserZbozi, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['uuid'],
      include: [{
        model: db.Users,
        required: true,
        attributes: ['isAdmin','uuid']
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.privileges);
      }
      var update = {};
      if ('Finished' in req.body) {
        update['StepZboziFinished'] = req.body.Finished;
      }
      if (Object.keys(update).length > 0) {
        return db.Users.update(update, {
          where: {
            uuid: sessions.user.dataValues.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.user.dataValues.uuid
          }
        }).then(zbozi => {
          return reply.send(msg.update);
        });
      }
      return reply.send(msg.update);
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/get_help', { schema: schemas.getHelp, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        required: true,
        attributes: ['StepHelpFinished']
      }]
    }).then(sessions => {
      if (!sessions.dataValues.user) {
        return reply.send(msg.auth);
      }
      return reply.send({ result: 1, Finished: sessions.dataValues.user.dataValues.StepHelpFinished });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/get_user_help', { schema: schemas.getUserHelp, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        where: {
          isAdmin: true
        },
        required: true,
        attributes: ['uuid']
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.privileges);
      }
      return db.Users.findOne({
        where: {
          uuid: req.body.uuid,
        },
        attributes: ['StepHelpFinished']
      }).then(user => {
        return reply.send({ result: 1, Finished: user.dataValues.StepHelpFinished });
      });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/update_help', { schema: schemas.updateHelp, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['uuid']
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.auth);
      }
      return db.Users.update({ StepHelpFinished: req.body.Finished }, {
        where: {
          uuid: sessions.dataValues.uuid
        }
      }).then(help => {
        return reply.send(msg.update);
      });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/update_groupid', { schema: schemas.updateGroupId, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        where: {
          isAdmin: true
        },
        required: true,
        attributes: ['email','groupId']
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.privileges);
      }
      return db.Users.update({ groupId: req.body.groupId}, {
        where: {
          email: req.body.email
        }
      }).then(rows => {
         return reply.send(msg.update);
      });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/update_user_help', { schema: schemas.updateUserHelp, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        where: {
          isAdmin: true
        },
        required: true,
        attributes: ['uuid']
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.privileges);
      }
      return db.Users.update({ StepHelpFinished: req.body.Finished }, {
        where: {
          uuid: req.body.uuid
        }
      }).then(help => {
        return reply.send(msg.update);
      });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/get_team', { schema: schemas.getTeam, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        required: true,
        attributes: ['StepTeamFinished']
      }]
    }).then(sessions => {
      if (!sessions.dataValues.user) {
        return reply.send(msg.auth);
      }
      return reply.send({ result: 1, Finished: sessions.dataValues.user.dataValues.StepTeamFinished });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/get_users', { schema: schemas.getUsers, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
      return db.Sessions.findOne({
          where: {
              session: req.body.session,
              ip: req.raw.connection.remoteAddress
          },
          attributes: ['session', 'ip'],
          include: [{
              model: db.Users,
              where: {
                  isAdmin: true
              },
              required: true,
              attributes: ['uuid']
          }]
      }).then(sessions => {
          if (!sessions) {
              return reply.send(msg.privileges);
          }
          return db.Users.findAll({
              where: {
                  uuid: {
                      [db.Op.ne]: sessions.dataValues.user.uuid
                     
                  },
                  [db.Op.or]: [
                      { regEmail: { [db.Op.like]: (req.body.filter) ? '%' + req.body.filter + '%' : 'nodata' } },
                      { name: { [db.Op.like]: (req.body.filter) ? '%' + req.body.filter + '%' : 'nodata' } },
                      { surName: { [db.Op.like]: (req.body.filter) ? '%' + req.body.filter + '%' : 'nodata' } },
                      { uuid: { [db.Op.like]: (req.body.filter) ? '%' + req.body.filter + '%' : 'nodata' } },
                      { uuid: { [db.Op.like]: (req.body.filter == 'allData') ? '%%' : 'nodata' } }
                  ]
              },
              raw: true,
              attributes: [
                  'uuid',
                  'email',
                  'Name',
                  'Surname',
                  'City',
                  'PostCode',
                  'StreetACP',
                  'Telephone',
                  'Company',
                  'Dic',
                  'Ico',
                  'Level',
                  'StepProfileFinished',
                  'RegComplete',
                  'RegEmail',
                  'CreditCounts',
                  'CreditVariant',
                  'InvoicePeriod',
                  'NextPayDate',
                  'NextPayDate_ts',
                  'CreditNextPayDate',
                  'CreditNextPayDate_ts',
                  'PaymentVersion',
                  'Price',
                  'RegisterDate',
                  'Trial',
                  'StepHelpFinished',
                  'heurekaAPIkey',
                  'StepHeurekaFinished',
                  'StepTeamFinished',
                  'a_box',
                  'a_cha',
                  'deadtimeExpiration',
                  'groupId',
                  'isAdmin',
                  'StepZboziFinished',
                  'topVariablesAllowed',
                  'abTestingAllowed'
              ]
          }).then(users => {
              return reply.send({ result: 1, users: users });
          });
      }).catch(err => {
          console.log(err);
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/update_user', { schema: schemas.updateUser, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        where: {
          isAdmin: true
        },
        required: true,
        attributes: ['uuid']
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.privileges);
      }
      var update = {};
      if ('email' in req.body) {
        update['email'] = req.body.email;
      }
      if ('Name' in req.body) {
        update['Name'] = req.body.Name;
      }
      if ('Surname' in req.body) {
        update['Surname'] = req.body.Surname;
      }
      if ('City' in req.body) {
        update['City'] = req.body.City;
      }
      if ('PostCode' in req.body) {
        update['PostCode'] = req.body.PostCode;
      }
      if ('StreetACP' in req.body) {
        update['StreetACP'] = req.body.StreetACP;
      }
      if ('Telephone' in req.body) {
        update['Telephone'] = req.body.Telephone;
      }
      if ('Company' in req.body) {
        update['Company'] = req.body.Company;
      }
      if ('Dic' in req.body) {
        update['Dic'] = req.body.Dic;
      }
      if ('Ico' in req.body) {
        update['Ico'] = req.body.Ico;
      }
      if ('Level' in req.body) {
        update['Level'] = req.body.Level;
      }
      if ('StepProfileFinished' in req.body) {
        update['StepProfileFinished'] = req.body.StepProfileFinished;
      }
      if ('RegComplete' in req.body) {
        update['RegComplete'] = req.body.RegComplete;
      }
      if ('RegEmail' in req.body) {
        update['RegEmail'] = req.body.RegEmail;
      }
      if ('CreditCounts' in req.body) {
        update['CreditCounts'] = req.body.CreditCounts;
      }
      if ('CreditVariant' in req.body) {
        update['CreditVariant'] = req.body.CreditVariant;
      }
      if ('InvoicePeriod' in req.body) {
        update['InvoicePeriod'] = req.body.InvoicePeriod;
      }
      if ('NextPayDate' in req.body) {
        update['NextPayDate'] = req.body.NextPayDate;
      }
      if ('NextPayDate_ts' in req.body) {
        update['NextPayDate_ts'] = req.body.NextPayDate_ts;
      }
      if ('CreditNextPayDate' in req.body) {
        update['CreditNextPayDate'] = req.body.CreditNextPayDate;
      }
      if ('CreditNextPayDate_ts' in req.body) {
        update['CreditNextPayDate_ts'] = req.body.CreditNextPayDate_ts;
      }
      if ('PaymentVersion' in req.body) {
        update['PaymentVersion'] = req.body.PaymentVersion;
      }
      if ('Price' in req.body) {
        update['Price'] = req.body.Price;
      }
      if ('RegisterDate' in req.body) {
        update['RegisterDate'] = req.body.RegisterDate;
      }
      if ('Trial' in req.body) {
        update['Trial'] = req.body.Trial;
      }
      if ('StepHelpFinished' in req.body) {
        update['StepHelpFinished'] = req.body.StepHelpFinished;
      }
      if ('heurekaAPIkey' in req.body) {
        update['heurekaAPIkey'] = req.body.heurekaAPIkey;
      }
      if ('StepHeurekaFinished' in req.body) {
        update['StepHeurekaFinished'] = req.body.StepHeurekaFinished;
      }
      if ('StepTeamFinished' in req.body) {
        update['StepTeamFinished'] = req.body.StepTeamFinished;
      }
      if ('a_box' in req.body) {
        update['a_box'] = req.body.a_box;
      }
      if ('a_cha' in req.body) {
        update['a_cha'] = req.body.a_cha;
      }
      if ('deadtimeExpiration' in req.body) {
        update['deadtimeExpiration'] = req.body.deadtimeExpiration;
      }
      if ('groupId' in req.body) {
        update['groupId'] = req.body.groupId;
      }
      if ('isAdmin' in req.body) {
        update['isAdmin'] = req.body.isAdmin;
      }
      if ('topVariablesAllowed' in req.body) {
          update['topVariablesAllowed'] = req.body.topVariablesAllowed;
      }
      if ('abTestingAllowed' in req.body) {
          update['abTestingAllowed'] = req.body.abTestingAllowed;
      }
      if ('note' in req.body) {
          update['note'] = req.body.note;
      }
      if ('internalNote' in req.body) {
          update['internalNote'] = req.body.internalNote;
      }

      if (Object.keys(update).length > 0) {
        return db.Users.update(update, {
          where: {
            uuid: req.body.uuid
          }
        }).then(user => {
          if ('email' in req.body) {
            //send email
          }
          return reply.send(msg.update);
        });
      }
      return reply.send(msg.update);
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/delete', { schema: schemas.delete, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        where: {
          isAdmin: true
        },
        required: true,
        attributes: ['uuid']
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.privileges);
      }
      if (req.body.what === 'heureka') {
        return db.Reviews.destroy({
          where: {
            uuid: req.body.uuid
          }
        }).then(rows => {
          return reply.send(msg.delete);
        });
      } else if (req.body.what === 'visits') {
        return db.Visits.destroy({
          where: {
            uuid: req.body.uuid
          }
        }).then(rows => {
          return reply.send(msg.delete);
        });
      } else if (req.body.what === 'forms') {
        return db.Forms.destroy({
          where: {
            uuid: req.body.uuid
          }
        }).then(rows => {
          return reply.send(msg.delete);
        });
      } else if (req.body.what === 'account') {
        return db.Users.destroy({
          where: {
            uuid: req.body.uuid
          }
        }).then(rows => {
          if (rows < 1) {
            return reply.send(msg.db);
          }
          return reply.send(msg.delete);
        });
      }
      return reply.send(msg.delete);
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/getNDictionary', { schema: schemas.getNDictionary, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                where: {
                    isAdmin: true
                },
                required: true,
                attributes: ['uuid']
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return db.NotificationsDictionary.findAll({
                where: {
                    using: { [db.Op.like]: (req.body.using) ? req.body.using : '%' }
                },
                raw: true,
                attributes: ['id', 'systemName', 'cs', 'sk', 'en','using']
            }).then(nDictionary => {
                return reply.send({ result: 1, code: 'get-ok', message: 'notification Dictionary loaded successfully', nDictionary: nDictionary });
            });
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});
server.post('/updateNDictionary', { schema: schemas.updateNDictionary, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                where: {
                    isAdmin: true
                },
                required: true,
                attributes: ['uuid']
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            var update = {};
            update[req.body.column] = req.body.value;

            if (Object.keys(update).length > 0) {
                return db.NotificationsDictionary.update(update, {
                    where: {
                        id: req.body.id
                    }
                }).then(translate => {
                    return reply.send({ result: 1, code: 'set-ok', message: 'notification Dictionary updated successfully' });
                });
            }
        }).catch(err => {
            console.log(err);
            return reply.send(msg.db);
        });
    }
    return reply.send(msg.auth);
});

server.post('/update_team', { schema: schemas.updateTeam, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['uuid']
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.auth);
      }
      return db.Users.update({ StepTeamFinished: req.body.Finished }, {
        where: {
          uuid: sessions.dataValues.uuid
        }
      }).then(team => {
        return reply.send(msg.update);
      });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/credits', { schema: schemas.credits, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        attributes: [
          'CreditCounts',
          'CreditVariant',
          'deadtimeExpiration',
          'InvoicePeriod',
          'NextPayDate',
          'NextPayDate_ts',
          'CreditNextPayDate',
          'CreditNextPayDate_ts',
          'PaymentVersion',
          'Price',
          'RegisterDate',
          'Trial'
        ],
        required: true
      }]
    }).then(sessions => {
      if (!sessions.dataValues.user) {
        return reply.send(msg.auth);
      }
      sessions.dataValues.user.dataValues['result'] = 1;
      return reply.send(sessions.dataValues.user.dataValues);
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/user_credits', { schema: schemas.userCredits, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        where: {
          isAdmin: true
        },
        attributes: ['isAdmin','uuid'],
        required: true
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.privileges);
      }
      return db.Users.findOne({
        where: {
          uuid: sessions.dataValues.user.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.user.uuid
        },
        attributes: [
          'CreditCounts',
          'CreditVariant',
          'deadtimeExpiration',
          'InvoicePeriod',
          'NextPayDate',
          'NextPayDate_ts',
          'CreditNextPayDate',
          'CreditNextPayDate_ts',
          'PaymentVersion',
          'Price',
          'RegisterDate',
          'Trial',
          'a_box',
          'a_cha',
          'groupId',
          'isAdmin',
          'topVariablesAllowed',
          'abTestingAllowed',
          'note',
          'internalNote'
        ]
      }).then(user => {
        user.dataValues['result'] = 1;
        return reply.send(user.dataValues);
      });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/signup', { schema: schemas.user, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    return reply.code(400).send(req.validationError);
  }
  reply.header('Content-Type', 'application/json').code(200);
  recaptcha.validate(req.body.recaptcha).then(function() {
    return db.Users.create({
      email: req.body.email,
      password: req.body.password,
      abTestingAllowed: 1,
      RegEmail: req.body.email,
      SmartStamp: moment().unix(),
      NextPayDate: (req.body.trial) ? moment().add(30, 'days').format('YYYY-MM-DD') : moment().add(14, 'days').format('YYYY-MM-DD'),
      NextPayDate_ts: (req.body.trial) ? moment().add(30, 'days').unix() : moment().add(14, 'days').unix(),
      CreditNextPayDate: (req.body.trial) ? moment().add(30, 'days').format('YYYY-MM-DD') : moment().add(14, 'days').format('YYYY-MM-DD'),
      CreditNextPayDate_ts: (req.body.trial) ? moment().add(30, 'days').unix() : moment().add(14, 'days').unix(),
      RegisterDate: moment().format('YYYY-MM-DD'),
      deadtimeExpiration: moment().add(1, 'years').unix()
    }).then(user => {
      return reply.send(msg.signup.ok);
        }).catch(err => {
           // console.log(err);
      return reply.send('email' in err.fields ? msg.signup.email : msg.db);
    });
  }).catch(function(errorCodes) {
    console.log(recaptcha.translateErrors(errorCodes));
    return reply.send(msg.captcha);
  });
});
server.post('/login', { schema: schemas.user, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    return reply.code(400).send(req.validationError);
  }
  reply.header('Content-Type', 'application/json').code(200);
  return recaptcha.validate(req.body.recaptcha).then(function() {
    return db.Users.findOne({
      where: {
        email: req.body.email
      },
        attributes: ['uuid', 'password', 'deadtimeExpiration', 'topVariablesAllowed', 'abTestingAllowed']
    }).then(user => {
      if (!user) {
        return reply.send(msg.login.user);
      } else {
        return user.comparePassword(req.body.password).then(authenticated => {
          if (authenticated) {
            if (moment().unix() > user.dataValues['deadtimeExpiration']) {
              return reply.send(msg.expired);
            }
            return db.Sessions.create({
              ip: req.raw.connection.remoteAddress,
              uuid: user.dataValues.uuid,
              lastActivity: moment().unix()
            }).then(session => {
              if (!session) {
                return reply.send(msg.db);
              } else {
                  return reply.send({ result: 1, code: 'login-success', message: 'Login Successful', session: session.dataValues.session, topVariables: user.dataValues['topVariablesAllowed'], abTesting: user.dataValues['abTestingAllowed'] });
              }
            });
          } else {
            return reply.send(msg.login.password);
          }
        }).catch(err => {
          return reply.send(msg.login.bcrypt);
        });
      }
    }).catch(err => {
      return reply.send(msg.db);
    });
  }).catch(function(errorCodes) {
    //console.log(recaptcha.translateErrors(errorCodes));
    return reply.send(msg.captcha);
  });
});
server.post('/reset_password', { schema: schemas.resetPassword, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    return reply.code(400).send(req.validationError);
  }
  reply.header('Content-Type', 'application/json').code(200);
  return recaptcha.validate(req.body.recaptcha).then(function() {
    var confirmation = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    return db.Users.update({
        confirmation: confirmation,
        confirmExpiry: moment().unix()
    }, {
      where: {
        email: req.body.email
      }
    }).then(user => {
        if (user[0] > 0) {
            return email.contactPasswordUpdate(req.body.email, cfg.smartemailing.resetPassword.list, [{ id: cfg.smartemailing.resetPassword.custom, value: confirmation }]
            ).then(updated => {
                    return reply.send(msg.password.email);
            }).catch(err => {
                    return reply.send(msg.email);
            });
        } else {
            return reply.send(msg.emailNotExist);
        }
    }).catch(err => {
      console.log(err.message);
      return reply.send(msg.db);
    });
  }).catch(function(errorCodes) {
    //console.log(recaptcha.translateErrors(errorCodes));
    return reply.send(msg.captcha);
  });
});
server.post('/new_password', { schema: schemas.newPassword, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    return reply.code(400).send(req.validationError);
  }
  reply.header('Content-Type', 'application/json').code(200);
  recaptcha.validate(req.body.recaptcha).then(function() {
    return db.Users.findOne({
      where: {
        email: req.body.email
      },
      attributes: ['uuid', 'confirmation','Level']
    }).then(user => {
      if (!user) {
        return reply.send(msg.login.user);
      }
      if (user.dataValues.confirmation !== req.body.confirmation) {
        return reply.send(msg.password.confirmation);
      }
      if ('password' in req.body && req.body.password.length > 5) {
        return db.Users.update({
          password: req.body.password
        }, {
          where: {
            uuid: user.dataValues.uuid,
            email: req.body.email,
            confirmation: req.body.confirmation
          },
          individualHooks: true
        }).then(userUpd => {
            return email.contactPasswordUpdate(req.body.email, cfg.smartemailing.resetPassword.complete).then(updated => {
            return reply.send(msg.password.ok);
          }).catch(err => {
            return reply.send(msg.email);
          });
        }).catch(err => {
          return reply.send(msg.db);
        });
      } else if (user.dataValues.confirmation === req.body.confirmation) {
        return reply.send(msg.password.confirmed);
      }
      return reply.send(msg.password.error);
    }).catch(err => {
      return reply.send(msg.db);
    });
  }).catch(function(errorCodes) {
    //console.log(recaptcha.translateErrors(errorCodes));
    return reply.send(msg.captcha);
  });
});
server.post('/get_appsettings', { schema: schemas.getAppsettings, attachValidation: true }, (req, reply) => {
  reply.header('Content-Type', 'application/json').code(200);
      return db.Appsettings.findAll({ 
       raw: true,
        attributes: [
          'paymentVersion',
          'creditVariant',
          'price',
          'invoicePerriod'
        ]
      }).then(appsettings => {
        return reply.send({ result: 1, appsettings: appsettings });
      });
  return reply.send(msg.auth);
});
server.post('/get_heurekaapikeys', { schema: schemas.getHeurekaApiKeys, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
      return db.Sessions.findOne({
          where: {
              session: req.body.session,
              ip: req.raw.connection.remoteAddress
          },
          attributes: ['session', 'ip'],
          include: [{
              model: db.Users,
              attributes: ['isAdmin', 'uuid'],
              required: true
          }]
      }).then(sessions => {
          if (!sessions) {
              return reply.send(msg.privileges);
          }
          return db.HeurekaApiKeys.findAll({
              where: {
                  uuid: sessions.dataValues.user.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.user.uuid
              },
              raw: true,
              attributes: [
                  'id',
                  'Name',
                  'heurekaAPIkey',
                  'country',
                  'isvalid',
                  'lastCheck',
                  'lastScore',
                  [Sequelize.literal('IFNULL((SELECT COUNT(`reviews`.`id`) FROM `reviews` WHERE `reviews`.`apiKey` = `heurekaapikeys`.`heurekaAPIkey`),0)'), 'count']
              ]
          }).then(heurekaapikeys => {
              return reply.send({ result: 1, heurekaapikeys: heurekaapikeys });
          });
      }).catch(err => {
          console.log(err);
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/insert_heurekaapikeys', { schema: schemas.insertHeurekaApiKeys, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        attributes: ['isAdmin','uuid'],
        required: true
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.privileges);
      }
      return db.HeurekaApiKeys.create({ 
        uuid: sessions.dataValues.user.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.user.uuid,
        Name: req.body.name,
        heurekaAPIkey: req.body.heurekaapikey,
        country: req.body.country,
        isvalid: req.body.isvalid
      }).then(heurekaapikeys => {
//console.log('update');
        return reply.send(msg.update);
      });
//console.log('no update');
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/get_zboziapikeys', { schema: schemas.getZboziApiKeys, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        attributes: ['isAdmin','uuid'],
        required: true
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.privileges);
      }
      return db.ZboziApiKeys.findAll({ 
        where: {
          uuid: sessions.dataValues.user.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.user.uuid
        },
        raw: true,
        attributes: [
          'id',
          'Name',
          'idProvozovny',
          'zboziAPIkey',
          'isvalid',
          'lastCheck',
          [Sequelize.literal('IFNULL((SELECT COUNT(`zbozi`.`id`) FROM `zbozi` WHERE `zbozi`.`apiKey` = `zboziapikeys`.`zboziAPIkey`),0)'), 'count'],
          [Sequelize.literal('IFNULL((SELECT COUNT(`zbozishop`.`id`) FROM `zbozishop` WHERE `zbozishop`.`apiKey` = `zboziapikeys`.`zboziAPIkey`),0)'), 'countShop']
        ]
      }).then(zboziapikeys => {
        return reply.send({ result: 1, zboziapikeys : zboziapikeys });
      });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/insert_zboziapikeys', { schema: schemas.insertZboziApiKeys, attachValidation: true }, (req, reply) => {
  if (req.validationError) {
    var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
    var code = error === msg.auth ? 200 : 400;
    return reply.code(code).send(error);
  }
  reply.header('Content-Type', 'application/json').code(200);
  if ('session' in req.body && req.body.session.length === 36) {
    return db.Sessions.findOne({
      where: {
        session: req.body.session,
        ip: req.raw.connection.remoteAddress
      },
      attributes: ['session', 'ip'],
      include: [{
        model: db.Users,
        attributes: ['isAdmin','uuid'],
        required: true
      }]
    }).then(sessions => {
      if (!sessions) {
        return reply.send(msg.privileges);
      }
      return db.ZboziApiKeys.create({ 
        uuid: sessions.dataValues.user.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.user.uuid,
        Name: req.body.name,
        idProvozovny: req.body.idprovozovny,
        zboziAPIkey: req.body.zboziapikey,
        isvalid: req.body.isvalid
      }).then(zboziapikeys => {
        return reply.send(msg.update);
      });
    }).catch(err => {
      return reply.send(msg.db);
    });
  }
  return reply.send(msg.auth);
});
server.post('/getParams', { schema: schemas.getParams, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if ('session' in req.body && req.body.session.length === 36) {
        return db.Sessions.findOne({
            where: {
                session: req.body.session,
                ip: req.raw.connection.remoteAddress
            },
            attributes: ['session', 'ip'],
            include: [{
                model: db.Users,
                attributes: ['isAdmin', 'uuid'],
                required: true
            }]
        }).then(sessions => {
            if (!sessions) {
                return reply.send(msg.privileges);
            }
            return db.TopVariables.findAll({
                where: {
                    uuid: sessions.dataValues.user.isAdmin && 'uuid' in req.body && req.body.uuid.length === 36 ? req.body.uuid : sessions.dataValues.user.uuid
                },
                raw: true,
                attributes: [
                    'parameter',
                    'paramMaxLength',
                    'created'
                ]
            }).then(params => {
                return reply.send({ result: 1, params: params });
            }).catch(err => {
                return reply.send(msg.db);
            });


        });
    }
    return reply.send(msg.auth);
});

////// EXTERNAL APIS
server.post('/getParamList', { schema: schemas.getParamList, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    reply.header('Content-Type', 'application/json').code(200);
    return db.Users.findOne({
        where: {
            uuid: req.body.uuid,
            email: req.body.email
        }
    }).then(user => {
        if (!user) {
            return reply.send(msg.login.user);
        } else if (!user.topVariablesAllowed) {
            return reply.send(msg.apiDisabled);
        } else {
            return user.comparePassword(req.body.password).then(authenticated => {
                if (authenticated) {
                    if (moment().unix() > user.dataValues['deadtimeExpiration']) {
                        return reply.send(msg.expired);
                    }
                    return db.TopVariables.findAll({
                        where: {
                            uuid: req.body.uuid
                        },
                        raw: true,
                        attributes: [
                            'parameter',
                            'paramMaxLength',
                            'created'
                        ]
                    }).then(params => {
                        return reply.send({ result: 1, params: params });
                    }).catch(err => {
                        return reply.send(msg.db);
                    });
                }
            });
        }
    });
    return reply.send(msg.auth);
});
server.post('/setNewParam', { schema: schemas.setNewParam, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }

    if (
        req.body.parameter.length > 0 && req.body.parameter.length <= 10 &&
        req.body.paramMaxLength > 1 && req.body.paramMaxLength <= 100
    ) {
        reply.header('Content-Type', 'application/json').code(200);
        return db.Users.findOne({
            where: {
                uuid: req.body.uuid,
                email: req.body.email
            }
        }).then(user => {
            if (!user) {
                return reply.send(msg.login.user);
            } else if (!user.topVariablesAllowed) {
                return reply.send(msg.apiDisabled);
            } else {
                return user.comparePassword(req.body.password).then(authenticated => {
                    if (authenticated) {
                        if (moment().unix() > user.dataValues['deadtimeExpiration']) {
                            return reply.send(msg.expired);
                        }
                        return db.TopVariables.create({
                            uuid: req.body.uuid,
                            parameter: req.body.parameter,
                            paramMaxLength: req.body.paramMaxLength
                        }).then(status => {
                            return reply.send(msg.created);
                        }).catch(err => {
                            var result = msg.db;
                            if (err.parent.sqlMessage) { result.message = err.parent.sqlMessage;}
                            return reply.send(result);
                        });
                    }
                });
            }
        });
    } else { //incorect data format
        return reply.send(msg.incorectData);
    }
    return reply.send(msg.auth);
});
server.post('/removeParam', { schema: schemas.removeParam, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }

    if (req.body.parameter.length > 0 && req.body.parameter.length <= 10) {
        reply.header('Content-Type', 'application/json').code(200);
        return db.Users.findOne({
            where: {
                uuid: req.body.uuid,
                email: req.body.email
            }
        }).then(user => {
            if (!user) {
                return reply.send(msg.login.user);
            } else if (!user.topVariablesAllowed) {
                return reply.send(msg.apiDisabled);
            } else {
                return user.comparePassword(req.body.password).then(authenticated => {
                    if (authenticated) {
                        if (moment().unix() > user.dataValues['deadtimeExpiration']) {
                            return reply.send(msg.expired);
                        }

                        return db.TopVariables.destroy({
                            where: {
                                uuid: req.body.uuid,
                                parameter: req.body.parameter
                            }
                        }).then(rows => {
                            if (rows < 1) {
                                var result = msg.db;
                                result.message = "Record doesn't exist";
                                return reply.send(result);
                            }
                            return reply.send(msg.delete);
                        }).catch(err => {
                            var result = msg.db;
                            if (err.parent.sqlMessage) { result.message = err.parent.sqlMessage; }
                            return reply.send(result);
                        });
                    }
                });
            }
        });
    } else { //incorect data format
        return reply.send(msg.incorectData);
    }
    return reply.send(msg.auth);
});
server.post('/getParamValueList', { schema: schemas.getParamValueList, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }
    if (req.body.parameter.length > 0 && req.body.parameter.length <= 10) {
        reply.header('Content-Type', 'application/json').code(200);
        return db.Users.findOne({
            where: {
                uuid: req.body.uuid,
                email: req.body.email
            }
        }).then(user => {
            if (!user) {
                return reply.send(msg.login.user);
            } else if (!user.topVariablesAllowed) {
                return reply.send(msg.apiDisabled);
            } else {
                return user.comparePassword(req.body.password).then(authenticated => {
                    if (authenticated) {
                        if (moment().unix() > user.dataValues['deadtimeExpiration']) {
                            return reply.send(msg.expired);
                        }
                        return db.TopValues.findAll({
                            where: {
                                uuid: req.body.uuid,
                                parameter: req.body.parameter,
                            },
                            offset: (req.body.offset) ? parseInt(req.body.limit) ? parseInt(req.body.offset) * parseInt(req.body.limit) : parseInt(req.body.offset) * 500 : 0 ,
                            limit: (req.body.limit && parseInt(req.body.limit)<500) ? parseInt(req.body.limit) : 500,
                            subQuery: false,
                            raw: true,
                            attributes: [
                                'parameter',
                                'value',
                                'timestamp',
                                'created'
                            ]
                        }).then(paramValues => {
                            return reply.send({ result: 1, paramValues: paramValues });
                            }).catch(err => {
                                console.log(err);
                            return reply.send(msg.db);
                        });
                    }
                });
            }
        });
    } else { //incorect data format
        return reply.send(msg.incorectData);
    }
    return reply.send(msg.auth);
});
server.post('/importParamValues', { schema: schemas.importParamValues, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        var error = typeof req.validationError.validation === 'object' && typeof req.validationError.validation[0] === 'object' && 'params' in req.validationError.validation[0] && typeof req.validationError.validation[0]['params'] === 'object' && 'missingProperty' in req.validationError.validation[0]['params'] && req.validationError.validation[0]['params']['missingProperty'] === 'session' ? msg.auth : req.validationError;
        var code = error === msg.auth ? 200 : 400;
        return reply.code(code).send(error);
    }

    if (
        req.body.import.length > 0 && req.body.import.length <= 100
    ) {
        reply.header('Content-Type', 'application/json').code(200);
        return db.Users.findOne({
            where: {
                uuid: req.body.uuid,
                email: req.body.email
            }
        }).then(user => {
            if (!user) {
                return reply.send(msg.login.user);
            } else if (!user.topVariablesAllowed) {
                return reply.send(msg.apiDisabled);
            }
            else {
                return user.comparePassword(req.body.password).then(authenticated => {
                    if (authenticated) {
                        if (moment().unix() > user.dataValues['deadtimeExpiration']) {
                            return reply.send(msg.expired);
                        }
                        return db.TopValues.bulkCreate(req.body.import).then(status => {
                            return reply.send(msg.created);
                        }).catch(err => {
                            var result = msg.db;
                            if (err.parent.sqlMessage) { result.message = err.parent.sqlMessage; }
                            return reply.send(result);
                        });
                    }
                });
            }
        });
    } else { //incorect data format
        return reply.send(msg.incorectData);
    }
    return reply.send(msg.auth);
});



server.post('/setShoptetApikey', { schema: schemas.setShoptetApikey, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if (req.body.apiKey !== undefined) {
        if (req.body.eshopId !== undefined && req.body.apiKey.length == 32) {
            return db.Users.findOne({
                where: {
                    apiKey: req.body.apiKey
                },
                raw: true,
                attributes: ['uuid']
            }).then(user => {
                if (!user) { return reply.send(msg.apiKeyNotExist); }

                return db.ShoptetCodes.findOne({
                    where: {
                        eshopId: req.body.eshopId
                    },
                    raw: true,
                    attributes: ['id']
                }).then(shopId => {
                    if (!shopId) { return reply.send(msg.shopNotRegistered); }
                    return db.ShoptetCodes.update({
                        uuid: user.uuid
                    }, {
                        where: {
                            eshopId: req.body.eshopId
                        }
                    }).then(shoptetUpd => {
                        return sequelize.query('CALL getThirdPartyData(:eshopId)',
                            {
                                replacements: {
                                    eshopId: req.body.eshopId
                                }
                            }).then(thirdPartyData => {

                                var tpd = thirdPartyData.map(function (tpData) {
                                    tpData.uuid = tpData['uuid'];
                                    tpData.apiKey = tpData['apiKey'];
                                    tpData.checkPixel = tpData['checkPixel'];
                                    tpData.CreditVariant = tpData['CreditVariant'];
                                    tpData.PaymentVersion = tpData['PaymentVersion'];
                                    tpData.CreditCounts = tpData['CreditCounts'];
                                    tpData.heurekaValid = tpData['heurekaValid'];
                                    tpData.zboziValid = tpData['zboziValid'];
                                    tpData.Level = tpData['Level'];
                                    tpData.activeCampaigns = JSON.parse(tpData['activeCampaigns']);
                                    return tpData;
                                });

                                //console.log(thirdPartyData, tpd, thirdPartyData['activeCampaigns']);

                                return reply.send({ result: 1, data: tpd[0] });
                            }).catch(err => {
                                return reply.send(msg.db);
                            });
                    }).catch(err => {
                        var result = msg.db;
                        result.message = err.message;
                        console.log(err);
                        return reply.send(result);
                    });

                }).catch(err => {
                    return reply.send(msg.db);
                });
            }).catch(err => {
                return reply.send(msg.db);
            });
        } else {
            return reply.send(msg.incorectData);
        }
    } else {
        return reply.send(msg.incorectData);
    }
    return reply.send(msg.incorectData);
});

server.post('/getThirdPartyData', { schema: schemas.getThirdPartyData, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if (req.body.eshopId !== undefined) {
        reply.header('Content-Type', 'application/json').code(200);
        return sequelize.query('CALL getThirdPartyData(:eshopId)',
            {
                replacements: {
                    eshopId: req.body.eshopId
                }

            }).then(thirdPartyData => {
                if (thirdPartyData.length == 0) {
                    return reply.send(msg.shopNotRegistered);
                }

                var accessToken = null;
                var tpd = thirdPartyData.map(function (tpData) {
                    tpData.uuid = tpData['uuid'];
                    tpData.apiKey = tpData['apiKey'];
                    tpData.checkPixel = tpData['checkPixel'];
                    tpData.CreditVariant = tpData['CreditVariant'];
                    tpData.PaymentVersion = tpData['PaymentVersion'];
                    tpData.CreditCounts = tpData['CreditCounts'];
                    tpData.heurekaValid = tpData['heurekaValid'];
                    tpData.zboziValid = tpData['zboziValid'];
                    tpData.Level = tpData['Level'];
                    tpData.activeCampaigns = JSON.parse(tpData['activeCampaigns']);
                    tpData.bearer = tpData['bearer'];
                    tpData.bearerValidity = tpData['bearerValidity'];
                    accessToken = tpData['accessToken'];
                    return tpData;
                });

                if (tpd[0].bearer.length == 0) {
                    var getShoptetBearer = axios({
                        method: 'post',
                        url: cfg.shoptet.tokenUrl,
                        timeout: cfg.shoptet.timeout,
                        headers: {
                            'Content-Type': cfg.shoptet.ContentType,
                            'Authorization': 'Bearer ' + accessToken
                        }
                    }).then(response => {
                        if (response.status === 200) {
                            return db.ShoptetCodes.update({
                                bearer: response.data.access_token,
                                bearerValidity: moment().add(3600 + response.data.expires_in, 'seconds').format('YYYY-MM-DD HH:mm:ss')
                            }, {
                                    where: {
                                        eshopId: req.body.eshopId
                                    }
                                }).then(shoptetUpd => {
                                    tpd[0].bearer = response.data.access_token;
                                    tpd[0].bearerValidity = moment().add(response.data.expires_in, 'seconds').format('YYYY-MM-DD HH:mm:ss');
                                    return reply.send({ result: 1, data: tpd[0] });
                                }).catch(err => {
                                    reply.header('Content-Type', 'application/json').code(400);
                                    var result = msg.db;
                                    result.message = err.message;
                                    console.log(err);
                                    return reply.send(result);
                                });
                        } else {
                            reply.header('Content-Type', 'application/json').code(400);
                            var result = msg.db;
                            result.message = err.message;
                            console.log(err);
                            return reply.send(result);
                        }
                    }).catch(err => {
                        reply.header('Content-Type', 'application/json').code(400);
                        var result = msg.db;
                        result.message = err.message;
                        console.log(err);
                        return reply.send(result);
                    });
                } else {
                    return reply.send({ result: 1, data: tpd[0] });
                }
            }).catch(err => {
                return reply.send(msg.db);
            });

    } else {
        return reply.send(msg.incorectData);
    }
    return reply.send(msg.incorectData);
});

server.post('/checkShoptetPixel', { schema: schemas.checkShoptetPixel, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }

    reply.header('Content-Type', 'application/json').code(200);
    if (req.body.eshopId != undefined) {
        return db.ShoptetCodes.findOne({
            where: {
                eshopId: req.body.eshopId
            },
            raw: true,
            attributes: ['uuid', 'bearer']
        }).then(shoptetBearer => {
            if (!shoptetBearer) { return reply.send(msg.shopNotRegistered); }

            var checkShoptetPixel = axios({
                method: 'GET',
                url: cfg.shoptet.templateUrl,
                timeout: cfg.shoptet.timeout,
                headers: {
                    'Content-Type': cfg.shoptet.ContentType,
                    'shoptet-access-token': shoptetBearer.bearer
                }
            }).then(response => {
                if (response.status === 200) {
                    if (response.data.data.snippets[0] != undefined) {
                        if (response.data.data.snippets[0].html.toString().indexOf(cfg.shoptet.pixelScriptUrl + "?id=" + shoptetBearer.uuid) > -1) {
                            return reply.send(msg.shoptetPixelInstaled);
                        } else {
                            return reply.send(msg.shoptetPixelNotInstaled);
                        }
                    } else {
                        return reply.send(msg.shoptetPixelNotInstaled);
                    }
                }
            }).catch(err => {
                reply.header('Content-Type', 'application/json').code(400);
                var result = msg.db;
                result.message = err.message;
                console.log(err);
                return reply.send(result);
            });
        }).catch(err => {
            return reply.send(msg.db);
        });
    } else {
        console.log("incorect data");
        reply.header('Content-Type', 'application/json').code(400);
        return reply.send(msg.incorectData);
    }
    return reply.send(msg.incorectData);
});


server.post('/installShoptetPixel', { schema: schemas.installShoptetPixel, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }

    reply.header('Content-Type', 'application/json').code(200);
    if (req.body.eshopId != undefined) {
        return db.ShoptetCodes.findOne({
            where: {
                eshopId: req.body.eshopId
            },
            raw: true,
            attributes: ['uuid', 'bearer']
        }).then(shoptetBearer => {
            if (!shoptetBearer) { return reply.send(msg.shopNotRegistered); }

            var installShoptetPixel = axios({
                method: 'POST',
                url: cfg.shoptet.templateUrl,
                timeout: cfg.shoptet.timeout,
                headers: {
                    'Content-Type': cfg.shoptet.ContentType,
                    'shoptet-access-token': shoptetBearer.bearer
                },
                data: {
                        "data": {
                            "snippets": [
                                {
                                    "location": "common-header",
                                    "html": "<script charset=\"UTF-8\" async src=\"" + cfg.shoptet.pixelScriptUrl + "?id=" + shoptetBearer.uuid+"\"></script>"
                                },
                                {
                                    "location":"order-confirmed",
                                    "html": "<script charset=\"UTF-8\" async src=\"" + cfg.shoptet.pixelScriptUrl + "?id=" + shoptetBearer.uuid + "\"></script>"
                                }
                            ]
                        }
                      }
            }).then(response => {
                if (response.status === 200) {
                    if (response.data.data.snippets[0].html.toString().indexOf(cfg.shoptet.pixelScriptUrl + "?id=" + shoptetBearer.uuid) > -1) {
                        return reply.send(msg.shoptetPixelInstaled);
                    } else {
                        return reply.send(msg.shoptetPixelNotInstaled);
                    }
                }
            }).catch(err => {
                reply.header('Content-Type', 'application/json').code(400);
                var result = msg.db;
                result.message = err.message;
                console.log(err);
                return reply.send(result);
            });
        }).catch(err => {
            return reply.send(msg.db);
        });
    } else {
        console.log("incorect data");
        reply.header('Content-Type', 'application/json').code(400);
        return reply.send(msg.incorectData);
    }
    return reply.send(msg.incorectData);
});

httpsServer.get('/installShoptet', { schema: schemas.installShoptet, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if (req.query.code != undefined) {
        if (req.query.code.length == 255) {
            return db.ShoptetCodes.create({
                code: req.query.code,
                status: 1
            }).then(status => {
                var getShoptetToken = axios({
                    method: 'post',
                    url: cfg.shoptet.oAuthUrl,
                    timeout: cfg.shoptet.timeout,
                    data: {
                        client_id: cfg.shoptet.oId,
                        client_secret: cfg.shoptet.oSecret,
                        code: req.query.code,
                        grant_type: "authorization_code",
                        scope: "api",
                        redirect_uri: cfg.shoptet.redirectUrl
                    }
                }).then(response => {
                    if (response.status === 200) {
                        return db.ShoptetCodes.update({
                            accessToken: response.data.access_token,
                            eshopId: response.data.eshopId
                        }, {
                            where: {
                                code: req.query.code,
                                uuid: null
                            }
                        }).then(shoptetUpd => {
                            //console.log("navrat", response.data.access_token, response.data.eshopId);
                            return reply.send(msg.created);
                        }).catch(err => {
                            reply.header('Content-Type', 'application/json').code(400);
                            var result = msg.db;
                            result.message = err.message;
                            console.log(err);
                            return reply.send(result);
                        });
                    }
                }).catch(err => {
                    reply.header('Content-Type', 'application/json').code(400);
                    var result = msg.db;
                    result.message = err.message;
                    console.log(err);
                    return reply.send(result);
                });
            }).catch(err => {
                reply.header('Content-Type', 'application/json').code(400);
                var result = msg.db;
                if (err.parent.sqlMessage) { result.message = err.parent.sqlMessage; }
                console.log(err);
                return reply.send(result);
            });

        } else {
            console.log("incorect data");
            reply.header('Content-Type', 'application/json').code(400);
            return reply.send(msg.incorectData);
        }
    } else {
        //console.log("redirect ok");
        return reply.send(msg.redirectOk);
    }
    return reply.send(msg.incorectData);
});

httpsServer.post('/uninstallShoptet', { schema: schemas.uninstallShoptet, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if (req.body.eshopId != undefined) {
        return db.ShoptetCodes.destroy({
            where: {
                eshopId: req.body.eshopId
            }
        }).then(rows => {
            if (rows < 1) {
                return reply.send(msg.db);
            }
            return reply.send(msg.uninstalled);
        }).catch(err => {
            reply.header('Content-Type', 'application/json').code(400);
            var result = msg.db;
            result.message = err.message;
            console.log(err);
            return reply.send(result);
        });
    } else {
        console.log("incorect data");
        reply.header('Content-Type', 'application/json').code(400);
        return reply.send(msg.incorectData);
    }
    return reply.send(msg.incorectData);
});

httpsServer.post('/pauseShoptet', { schema: schemas.uninstallShoptet, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if (req.body.eshopId != undefined) {
        return db.ShoptetCodes.update({
            status: 0
        }, {
                where: {
                    eshopId: req.body.eshopId
                }
            }).then(shoptetUpd => {
                return reply.send(msg.paused);
            }).catch(err => {
                reply.header('Content-Type', 'application/json').code(400);
                var result = msg.db;
                result.message = err.message;
                console.log(err);
                return reply.send(result);
            });
    } else {
        console.log("incorect data");
        reply.header('Content-Type', 'application/json').code(400);
        return reply.send(msg.incorectData);
    }
    return reply.send(msg.incorectData);
});

httpsServer.post('/runShoptet', { schema: schemas.uninstallShoptet, attachValidation: true }, (req, reply) => {
    if (req.validationError) {
        return reply.code(400).send(req.validationError);
    }
    reply.header('Content-Type', 'application/json').code(200);
    if (req.body.eshopId != undefined) {
        return db.ShoptetCodes.update({
            status: 1
        }, {
                where: {
                    eshopId: req.body.eshopId
                },
                individualHooks: true
            }).then(shoptetUpd => {
                return reply.send(msg.running);
            }).catch(err => {
                reply.header('Content-Type', 'application/json').code(400);
                var result = msg.db;
                result.message = err.message;
                console.log(err);
                return reply.send(result);
            });
    } else {
        console.log("incorect data");
        reply.header('Content-Type', 'application/json').code(400);
        return reply.send(msg.incorectData);
    }
    return reply.send(msg.incorectData);
});


server.listen(cfg.server.port, cfg.server.address, err => {
  if (err) throw err;
  console.log('Server listenting on ' + cfg.server.address + ':' + cfg.server.port);
});

httpsServer.listen(cfg.server.httpsPort, cfg.server.address, err => {
    if (err) throw err;
    console.log('Server listenting on ' + cfg.server.address + ':' + cfg.server.httpsPort);
});