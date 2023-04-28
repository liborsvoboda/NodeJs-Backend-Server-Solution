const uWS = require('uWebSockets.js');
const Sequelize = require('sequelize');
const IndexHints = Sequelize.IndexHints;
const moment = require('moment');
const fastJson = require('fast-json-stringify');
const Ajv = require('ajv');
const fs = require('fs');
const path = require('path');
//const decoder = require('text-encoding');
const decoder = new TextDecoder();
const db = require('./api_models/ws_db');

const cfg = JSON.parse(fs.readFileSync(path.join('./api_config/ws_config.json'), 'utf8'));
const schemas = JSON.parse(fs.readFileSync(path.join('./api_schemas/ws_schemas.json'), 'utf8'));
const messages = JSON.parse(fs.readFileSync(path.join('./api_messages/ws_messages.json'), 'utf8'));
const updateSchema = fastJson(schemas.default);
const statsSchema = fastJson(schemas.getStats.response);
const reviewsSchema = fastJson(schemas.getReviews.response);
const zboziProductSchema = fastJson(schemas.getZboziProduct.response);
const zboziShopSchema = fastJson(schemas.getZboziShop.response);
const formsSchema = fastJson(schemas.getForms.response);
const visitCountSchema = fastJson(schemas.getVisitCount.response);
const nDictionarySchema = fastJson(schemas.getNDictionary.response);
const ajv = new Ajv({ removeAdditional: true });
const updateVisitsSchema = ajv.compile(schemas.updateVisits.request);
const updateFormsSchema = ajv.compile(schemas.updateForms.request);
const getCampaignsSchema = ajv.compile(schemas.getCampaigns.request);
const getNDictionarySchema = ajv.compile(schemas.getNDictionary.request);
const getStatsSchema = ajv.compile(schemas.getStats.request);
const getReviewsSchema = ajv.compile(schemas.getReviews.request);
const getZboziProductSchema = ajv.compile(schemas.getZboziProduct.request);
const getZboziShopSchema = ajv.compile(schemas.getZboziShop.request);
const getFormsSchema = ajv.compile(schemas.getForms.request);
const getVisitCountSchema = ajv.compile(schemas.getVisitCount.request);

const getOwnNotifySchema = ajv.compile(schemas.getOwnNotify.request);
const ownNotifySchema = fastJson(schemas.getOwnNotify.response);

const sequelize = new Sequelize(cfg.db.dbname, cfg.db.user, cfg.db.password, {
  host: cfg.db.host,
  dialect: cfg.db.type,
  logging: false,
  operatorsAliases: false,
  pool: {
    max: cfg.db.poolMax,
    min: cfg.db.poolMin,
    acquire: cfg.db.poolAcquire,
    idle: cfg.db.poolIdle
  },
  keepDefaultTimezone: true
});

const getReviewsWhere = function(rating, heurekaAPIkey, last, review) {
  if (review) {
    return {
      id: {
        [Sequelize.Op.gt]: review
      },
      heurekaAPIkey: {
        [Sequelize.Op.gt]: heurekaAPIkey
      },
      rating: {
        [Sequelize.Op.gte]: rating
      },
      timestamp: {
        [Sequelize.Op.gt]: moment().subtract(last, 'days').unix()
      }
    };
  }
  return {
    rating: {
      [Sequelize.Op.gte]: rating
    },
    timestamp: {
      [Sequelize.Op.gt]: moment().subtract(last, 'days').unix()
    }
  };
};

const getZboziShopWhere = function(zboziAPIkey, last, zbozi) {
  if (zbozi) {
    return {
      id: {
        [Sequelize.Op.gt]: zbozi
      },
      zboziAPIkey: {
        [Sequelize.Op.gt]: zboziAPIkey
      },
      timestamp: {
        [Sequelize.Op.gt]: moment().subtract(last, 'days').unix()
      }
    };
  }
  return {
    timestamp: {
      [Sequelize.Op.gt]: moment().subtract(last, 'days').unix()
    }
  };
};

const getZboziProductWhere = function(rating, zboziAPIkey, last, zbozi) {
  if (zbozi) {
    return {
      id: {
        [Sequelize.Op.gt]: zbozi
      },
      zboziAPIkey: {
        [Sequelize.Op.gt]: zboziAPIkey
      },
      rating: {
        [Sequelize.Op.gte]: rating
      },
      timestamp: {
        [Sequelize.Op.gt]: moment().subtract(last, 'days').unix()
      }
    };
  }
  return {
    rating: {
      [Sequelize.Op.gte]: rating
    },
    timestamp: {
      [Sequelize.Op.gt]: moment().subtract(last, 'days').unix()
    }
  };
};

uWS.SSLApp({
  key_file_name: path.join(__dirname, cfg.ssl_key),
  cert_file_name: path.join(__dirname, cfg.ssl_cert)
}).ws('/*', {
  /* Options */
  compression: 0,
  maxPayloadLength: 16 * 1024 * 1024,
  idleTimeout: 121,
  /* Handlers */
  open: (ws, req) => {
    //
  },
  message: (ws, message, isBinary) => {
    /* Ok is false if backpressure was built up, wait for drain */
    //var ok = ws.send(message, isBinary);
    if (!isBinary) {
      try {
        var msg = JSON.parse(decoder.decode(message));
      } catch (e) {
        return ws.send(updateSchema(messages.request.error));
      }
      if (typeof msg === 'object' && 'method' in msg && 'data' in msg) {
        if (msg.method === 'update_visits') {
          if (!updateVisitsSchema(msg.data)) {
            var r = messages.request.error;
            r['req'] = msg.req;
            return ws.send(updateSchema(r));
          }
          //return db.Visitors.findOrCreate({
          //  where: {
          //    visitorID: msg.data.visitor.visitorID
          //    },
          //  defaults: msg.data.visitor
          //}).then(visitor => {
            return sequelize.query('CALL ws_writeVisit(:uuid,:visitorID,:url,:referer,:again,:abShown,:userAgent,:system,:language,:screenWidth,:screenHeight,:isMobile)', {
                replacements: {
                    uuid: msg.data.visit.uuid,
                    visitorID: msg.data.visitor.visitorID,
                    url: msg.data.visit.url.substr(0, 2040),
                    referer: (msg.data.visit.referer) ? msg.data.visit.referer.substr(0, 2040) : '',
                    again: msg.data.visit.again,
                    abShown: msg.data.visit.abShown,
                    userAgent: msg.data.visitor.userAgent,
                    system: (msg.data.visitor.system) ? msg.data.visitor.system : null,
                    language: (msg.data.visitor.language) ? msg.data.visitor.language : null,
                    screenWidth: (msg.data.visitor.screenWidth) ? msg.data.visitor.screenWidth : null,
                    screenHeight: (msg.data.visitor.screenHeight) ? msg.data.visitor.screenHeight : null,
                    isMobile: (msg.data.visitor.isMobile) ? msg.data.visitor.isMobile : false
                }
            }).then(visit => {
                //console.log("OK zapis visits");
                var r = messages.update.ok;
                r['req'] = msg.req;
                return ws.send(updateSchema(r));
            }).catch(err => {
                //console.log("chyba zapis visits", err);
                var r = messages.update.error;
                r['req'] = msg.req;
                return ws.send(updateSchema(r));
            });
         // }).then(visit => {
            //var r = messages.update.ok;
            //r['req'] = msg.req;
            //return ws.send(updateSchema(r));
          //}).catch(err => {
          //console.log("chyba zapis Visitors",err);
          //var r = messages.update.error;
          //  r['req'] = msg.req;
          //  return ws.send(updateSchema(r));
          //});
        } else if (msg.method === 'update_forms') {
          if (!updateFormsSchema(msg.data)) {
            var r = messages.request.error;
            r['req'] = msg.req;
            return ws.send(updateSchema(r));
          }
          return db.Visitors.findOrCreate({
            where: {
              visitorID: msg.data.visitor.visitorID
            },
            defaults: msg.data.visitor
          }).then(visitor => {
              return db.Forms.create({
                  uuid: msg.data.form.uuid,
                  visitorID: msg.data.form.visitorID,
                  form: msg.data.form.form,
                  url: msg.data.form.url,
                  referer: msg.data.form.referer,
                  geo: msg.data.form.geo,
                  country: (msg.data.form.country)? msg.data.form.country : null,
                  timestamp: moment().unix()
              });
          }).then(form => {
            var r = messages.update.ok;
            r['req'] = msg.req;
            return ws.send(updateSchema(r));
          }).catch(err => {
            var r = messages.update.error;
            r['req'] = msg.req;
            return ws.send(updateSchema(r));
          });
        } else if (msg.method === 'get_dictionary') {
            if (!getNDictionarySchema(msg.data)) {
                var r = messages.request.error;
                r['req'] = msg.req;
                return ws.send(updateSchema(r));
            }
            return db.NotificationsDictionary.findAll({
                where: {
                    using: 'bubble'
                },
                raw: true,
                attributes: ['systemName', 'cs', 'sk', 'en']
            }).then(nDictionary => {
                return ws.send(nDictionarySchema({ req: msg.req, result: 1, code: 'get-ok', message: nDictionary }));
            }).catch(err => {
                console.log("nDictionarySchema:", err);
                var r = messages.get.error;
                r['req'] = msg.req;
                return ws.send(updateSchema(r));
            });

        } else if (msg.method === 'get_campaigns') {
          if (!getCampaignsSchema(msg.data)) {
            var r = messages.request.error;
            r['req'] = msg.req;
            return ws.send(updateSchema(r));
          }
            return sequelize.query('CALL ws_getCampaigns(:uuid,:url,:visitorID)', {
                replacements: {
                    uuid: msg.data.id,
                    url: msg.data.host,
                    visitorID: msg.data.visitorID
                }
            }).then(campaigns => {
                const us = fastJson(schemas.getCampaigns);
                if (campaigns.length < 1) {
                  return ws.send(us({ req: msg.req, result: 1, code: 'get-ok', message: [] }));
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
              campaign.abTestId = JSON.parse(campaign.abTestId);
              campaign.showByAB = JSON.parse(campaign.showByAB);
              campaign.zeroCampaignAB = JSON.parse(campaign.zeroCampaignAB);
              return campaign;
            });

            //console.log(c[0]['user.NextPayDate_ts'],c[0]['user.CreditCounts']);
              return ws.send(us({
                  req: msg.req, result: 1, code: 'get-ok',
                  message: c,
                  serverTime: moment().unix(),
                  NextPayDate_ts: c[0]['NextPayDate_ts'],
                  a_box: c[0]['a_box'],
                  a_cha: c[0]['a_cha']
              }));
          }).catch(err => {
             // console.log("getcampaign", msg.data.id,err);
            var r = messages.get.error;
            r['req'] = msg.req;
            return ws.send(updateSchema(r));
          });
        } else if (msg.method === 'get_visitcount') {
          if (!getVisitCountSchema(msg.data)) {
            var r = messages.request.error;
            r['req'] = msg.req;
            return ws.send(updateSchema(r));
          }
          return sequelize.query('CALL ws_visitrequest(:campaignID,:url)', { replacements: {campaignID: msg.data.campaignID,url: msg.data.url} }).then(online => {
            return ws.send(visitCountSchema({ req: msg.req, result: 1, code: 'get-ok', message: online }));
          }).catch(err => {
            var r = messages.get.error;
            r['req'] = msg.req;
            return ws.send(updateSchema(r));
          });
        } else if (msg.method === 'get_stats') {
          if (!getStatsSchema(msg.data)) {
            var r = messages.request.error;
            r['req'] = msg.req;
            return ws.send(updateSchema(r));
          }
          return sequelize.query('CALL ws_statrequest(:uuid,:campaignID,:typeRequest,:lastDays,:url)', 
            {
              replacements: {
                uuid: msg.data.uuid,
                campaignID: msg.data.campaignID,
                typeRequest: msg.data.typeRequest,
                lastDays: msg.data.lastDays,
                url: msg.data.url
              } 
            }).then(stats => {
              return ws.send(statsSchema({ req: msg.req, result: 1, code: 'get-ok', message: stats }));
            }).catch(err => {
              var r = messages.get.error;
              r['req'] = msg.req;
              return ws.send(updateSchema(r));
            });
        } else if (msg.method === 'get_ownnotify') {
          if (!getOwnNotifySchema(msg.data)) {
            var r = messages.request.error;
            r['req'] = msg.req;
            return ws.send(updateSchema(r));
          }
          return sequelize.query('CALL ws_ownnotifyrequest(:uuid,:campaignID)', 
            {
              replacements: {
                uuid: msg.data.uuid,
                campaignID: msg.data.campaignID
              } 
            }).then(ownnotify => {
             var o = ownnotify.map(function(ownNotify) {
               ownNotify= JSON.parse(ownNotify.OwnNotify);
               return ownNotify; 
             });
             var i = ownnotify.map(function(ownNotifyIcons) {
               ownNotifyIcons= JSON.parse(ownNotifyIcons.OwnNotifyIcons);
               return ownNotifyIcons; 
             });
              
            var idataResult1 = ownnotify.map(function (ownNotify) {
                dataResult1 = JSON.parse(JSON.stringify(ownNotify.dataResult1.replace(/'/g, '"')));
                return dataResult1;
            });
            var idataResult2 = ownnotify.map(function (ownNotify) {
                dataResult2 = JSON.parse(JSON.stringify(ownNotify.dataResult2.replace(/'/g, '"')));
                return dataResult2;
            });
            var idataResult3 = ownnotify.map(function (ownNotify) {
                dataResult3 = JSON.parse(JSON.stringify(ownNotify.dataResult3.replace(/'/g, '"')));
                return dataResult3;
            });
            var idataResult4 = ownnotify.map(function (ownNotify) {
                dataResult4 = JSON.parse(JSON.stringify(ownNotify.dataResult4.replace(/'/g, '"')));
                return dataResult4;
            });
            var idataResult5 = ownnotify.map(function (ownNotify) {
                dataResult5 = JSON.parse(JSON.stringify(ownNotify.dataResult5.replace(/'/g, '"')));
                return dataResult5;
            });

                return ws.send(ownNotifySchema({ req: msg.req, result: 1, code: 'get-ok', message: o, OwnNotifyIcons: i, dataResult1: idataResult1, dataResult2: idataResult2, dataResult3: idataResult3, dataResult4: idataResult4, dataResult5: idataResult5 }));
            }).catch(err => {
              var r = messages.get.error;
              r['req'] = msg.req;
              return ws.send(updateSchema(r));
            });
        } else if (msg.method === 'get_forms') {
          if (!getFormsSchema(msg.data)) {
            var r = messages.request.error;
            r['req'] = msg.req;
            return ws.send(updateSchema(r));
          }
          return sequelize.query('CALL ws_formrequest(:uuid,:campaignID,:typeRequest,:ownForms,:visitorID,:anonymous,:lastDays,:limitRec,:url)', 
            {
              replacements: {
                uuid: msg.data.uuid,
                campaignID: msg.data.campaignID,
                typeRequest: msg.data.typeRequest,
                ownForms: msg.data.ownForms,
                visitorID: msg.data.visitorID,
                anonymous: msg.data.anonymous,
                lastDays: msg.data.lastDays,
                limitRec: msg.data.limitRec,
                url: msg.data.url
              } 
          }).then(forms => {
            return ws.send(formsSchema({ req: msg.req, result: 1, code: 'get-ok', message: forms }));
          }).catch(err => {
            var r = messages.get.error;
            r['req'] = msg.req;
            return ws.send(updateSchema(r));
          });
        } else if (msg.method === 'get_reviews') {
          if (!getReviewsSchema(msg.data)) {
            var r = messages.request.error;
            r['req'] = msg.req;
            return ws.send(updateSchema(r));
          }
          var where = getReviewsWhere(msg.data.rating, msg.data.campaignID, msg.data.last, msg.data.review);
          return db.Campaigns.findAll({
            where: {
              uuid: msg.data.id,
              campaignID: msg.data.campaignID
            },
            attributes: [
                [Sequelize.col('review.id'), 'id'],
                [Sequelize.col('review.summary'), 'summary'],
                [Sequelize.col('review.pros'), 'pros'],
                [Sequelize.col('review.timestamp'), 'timestamp'],
                [Sequelize.col('review.rating'), 'rating']
            ],
            include: [
            {
                model: db.HeurekaApiKeys,
                attributes: []
                , where: {
                    uuid: [Sequelize.col('campaigns.uuid')],
                    lastScore: {[Sequelize.Op.gte]: 4}
                }
            },
            {
                model: db.Reviews,
                where: where,
                attributes: []
            }
            ],
            order: [
              [Sequelize.fn('RAND')]
            ],
           // group: Sequelize.col('review.id'),
            raw: true
          }).then(user => {
            return ws.send(reviewsSchema({ req: msg.req, result: 1, code: 'get-ok', message: user }));
          }).catch(err => {
              console.log("reviewsSchema:",err);
            var r = messages.get.error;
            r['req'] = msg.req;
            return ws.send(updateSchema(r));
          });
        } else if (msg.method === 'get_zbozishop') {
          if (!getZboziShopSchema(msg.data)) {
            var r = messages.request.error;
            r['req'] = msg.req;
            return ws.send(updateSchema(r));
          }
          var where = getZboziShopWhere(msg.data.campaignID, msg.data.last, msg.data.zbozi);
          return db.Campaigns.findAll({
            where: {
              uuid: msg.data.id,
              campaignID: msg.data.campaignID
            },
            attributes: [[Sequelize.col('zbozishop.id'), 'id'], [Sequelize.col('zbozishop.rating'), 'rating'], [Sequelize.col('zbozishop.positiveComments'), 'positiveComments'], [Sequelize.col('zbozishop.timestamp'), 'timestamp']],
            include: [{
              model: db.ZboziShop,
              where: where,
              attributes: []
            }],
            order: [
              [Sequelize.fn('RAND')]
            ],
            group: Sequelize.col('zbozishop.id'),
            raw: true
          }).then(user => {
            return ws.send(zboziShopSchema({ req: msg.req, result: 1, code: 'get-ok', message: user }));
          }).catch(err => {
              console.log("zboziShopSchema",err);
            var r = messages.get.error;
            r['req'] = msg.req;
            return ws.send(updateSchema(r));
          });
        } else if (msg.method === 'get_zboziproduct') {
          if (!getZboziProductSchema(msg.data)) {
            var r = messages.request.error;
            r['req'] = msg.req;
            return ws.send(updateSchema(r));
          }
          var where = getZboziProductWhere(msg.data.rating, msg.data.campaignID, msg.data.last, msg.data.zbozi);
          return db.Campaigns.findAll({
            where: {
              uuid: msg.data.id,
              campaignID: msg.data.campaignID
            },
            attributes: [[Sequelize.col('zbozi.id'), 'id'], [Sequelize.col('zbozi.rating'), 'rating'], [Sequelize.col('zbozi.positiveComments'), 'positiveComments'], [Sequelize.col('zbozi.productName'), 'productName'], [Sequelize.col('zbozi.timestamp'), 'timestamp']],
            include: [{
              model: db.ZboziProduct,
              where: where,
              attributes: []
            }],
            order: [
              [Sequelize.fn('RAND')]
            ],
            group: Sequelize.col('zbozi.id'),
            raw: true
          }).then(user => {
            return ws.send(zboziProductSchema({ req: msg.req, result: 1, code: 'get-ok', message: user }));
          }).catch(err => {
              console.log("zboziProductSchema",err);
            var r = messages.get.error;
            r['req'] = msg.req;
            return ws.send(updateSchema(r));
          });
        }
      } else {
        var r = messages.request.error;
        r['req'] = msg.req;
        return ws.send(updateSchema(r));
      }
    }
  },
  drain: (ws) => {
    console.log('WebSocket backpressure: ' + ws.getBufferedAmount());
  },
  close: (ws, code, message) => {
   // console.log('WebSocket closed');
  }
}).any('/*', (res, req) => {
  // Load balancing
  res.writeHeader('content-type', 'application/json; charset=utf-8').writeHeader('Access-Control-Allow-Origin', '*').end(JSON.stringify({ ws: 'wss://' + cfg.host + ':' + cfg.port + '/' }));
}).listen(cfg.port, (token) => {
  if (token) {
    console.log('Listening to port ' + cfg.port);
  } else {
    console.log('Failed to listen to port ' + cfg.port);
  }
});
