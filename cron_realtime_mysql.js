const fs = require('fs');
const path = require('path');
const axios = require('axios');
const parser = require('fast-xml-parser');
const moment = require('moment');
const cron = require('node-cron');
const Sequelize = require('sequelize');
const ZongJi = require('zongji');
const db = require('./api_models/cron_db');
const email = require('./smartemailing');
const Promise = require('bluebird');
const nodemailer = require('nodemailer');

const cronCfg = JSON.parse(fs.readFileSync(path.join('./api_config/cron_config.json'), 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.join( './api_config/api_config.json'), 'utf8'));
const zongji = new ZongJi(cfg.server.db.realtime);

const czechNames = JSON.parse(fs.readFileSync(path.join('./data_lists/czech_names.json'), 'utf8'));
const slovakNames = JSON.parse(fs.readFileSync(path.join('./data_lists/sk_names.json'), 'utf8'));
const englishNames = JSON.parse(fs.readFileSync(path.join('./data_lists/en_names.json'), 'utf8'));

const czechCityNames = JSON.parse(fs.readFileSync(path.join('./data_lists/city_names.json'), 'utf8'));
const slovakCityNames = JSON.parse(fs.readFileSync(path.join('./data_lists/city_namesSK.json'), 'utf8'));

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

var transporter = nodemailer.createTransport({
    host: cronCfg.smtp.host,
    port: cronCfg.smtp.port,
    secure: cronCfg.smtp.secure, // upgrade later with STARTTLS
    auth: {
        user: cronCfg.smtp.auth.user,
        pass: cronCfg.smtp.auth.pass
    },
    tls: {
        rejectUnauthorized: cronCfg.smtp.auth.rejectUnauthorized
    }
});


function sendAbtestStartedMail(abTestId) {

    return sequelize.query('CALL getAbTestMailData(:abTestId)', { replacements: { abTestId: abTestId } }
    ).then(abTest => {
        let variants = JSON.parse(abTest[0].campaignNames.replace('"', '\"'));
        let targetNames = JSON.parse(abTest[0].targetUrlsNames.replace('"', '\"'));

        let info = transporter.sendMail({
            from: 'info@app.cz', // sender address
            to: abTest[0].emailAddress, // list of receivers
            cc: abTest[0].emailAddresses,
            bcc: 'admin@app.cz',
            subject: "Vytvoření AB testu: " + abTest[0].name, // Subject line
            html: '<html><head><title>[app] Vytvořen nový A/B test klienta: ' + abTest[0].uuid + '</title></head><body><span style="font-size:15px;">Krásný den,<br /><br />' +
                'skvělá zpráva, A/B test <b>' + abTest[0].name + ' klienta: ' + abTest[0].uuid + '</b> právě byl právě vytvořen.<br /><br /><br /><b>Testovány budou tyto kampaně (varianty):</b><br />' +
                ((variants[0] != undefined) ? variants[0] + '<br />' : '') +
                ((variants[1] != undefined) ? variants[1] + '<br />' : '') +
                ((variants[2] != undefined) ? variants[2] + '<br />' : '') +
                ((variants[3] != undefined) ? variants[3] + '<br />' : '') +
                '<br /><br /><b>Zajímá vás splnění následujícího cíle:</b></b><br />' +
                ((targetNames[0] != undefined) ? targetNames[0] + '<br />' : '') +
                ((targetNames[1] != undefined) ? targetNames[1] + '<br />' : '') +
                ((targetNames[2] != undefined) ? targetNames[2] + '<br />' : '') +
                '<br /><br /><br /><br /><br />Ať objednávky rostou,<br /><br /><img alt="Petr a Katka z app" height="95" src="https://s3-eu-west-1.amazonaws.com/se20-account-data/127760/media/petr-katka-podpis-2020.jpg?2w4bw91b" width="200" /><br />Petr a Katka z app.cz<br /><br /><br /></span></span><table border="0" cellpadding="0" cellspacing="0" width="100%"><tbody><tr><td align="center"><hr /><p><span style="font-size:12px;"><span style="font-family:Arial,Helvetica,sans-serif;">E-mail: <a rel="noreferrer">info@app.cz</a> | Tel: +420 608 915 592  |  app s.r.o., IČO: 07602677, DIČ: CZ07602677, Rybná 716/24, Praha 1 – Staré Město, 110 00</span></span></p><hr /></td></tr><tr><td align="center"><p><span style="font-size:12px;"><span style="font-family:Arial,Helvetica,sans-serif;">Zprávu jste obdrželi na základě registrace vašeho e-mailu pro zasílání výsledků statistik A/B testů z aplikace app.cz</span></span></p></td></tr></tbody></table></body></html>'
        });
    });
}

function sendAbtestEndedMail(abTestId) {

    return sequelize.query('CALL getAbTestMailData(:abTestId)', {replacements: {abTestId: abTestId}}
    ).then(abTest => {
        let variants = JSON.parse(abTest[0].campaignNames.replace('"','\"'));
        let targetNames = JSON.parse(abTest[0].targetUrlsNames.replace('"', '\"'));

        let info = transporter.sendMail({
            from: 'info@app.cz', // sender address
            to: abTest[0].emailAddress, // list of receivers
            cc: abTest[0].emailAddresses,
            bcc: 'admin@app.cz',
            subject: "Ukončení AB testu: " + abTest[0].name, // Subject line
            //text: "Hello world?", // plain text body
            html: '<html><head><title>[app] Výsledky A/B testu</title></head><body><img alt="Váš A/B test skončil. Podívejte se na výsledky. Otevřete a čtěte dál" height="60" src="https://s3-eu-west-1.amazonaws.com/se20-account-data/127760/media/hlavicka-email.jpg?zpqinosy" width="600" /><br /><br /><br /><span style="font-family:Arial,Helvetica,sans-serif;"><span style="font-size:15px;">Krásný den,<br /><br />' +
                'skvělá zpráva, váš A/B test <b>' + abTest[0].name + '</b> právě skončil a už máme výsledky.<br /><br /><br /><b>Testovali jste tyto kampaně (varianty):</b><br />' +
                ((variants[0] != undefined) ? variants[0] + '<br />' : '') +
                ((variants[1] != undefined) ? variants[1] + '<br />' : '') +
                ((variants[2] != undefined) ? variants[2] + '<br />' : '') +
                ((variants[3] != undefined) ? variants[3] + '<br />' : '') +
                '<br /><br /><b>Zajímalo vás splnění následujícího cíle:</b></b><br />' +
                ((targetNames[0] != undefined) ? targetNames[0] + '<br />' : '') +
                ((targetNames[1] != undefined) ? targetNames[1] + '<br />' : '') +
                ((targetNames[2] != undefined) ? targetNames[2] + '<br />' : '') +
                '<br /><br /><b>A jak to celé dopadlo?</b><br />' +
                'Přesná čísla a konverzní poměr <a href="https://app.app.cz/AbGraphs?testId=' + abTestId + '" title="Výsledky A/B testu zde" targe="_blank">najdete ve statistikách ZDE >>></a><br /><br /><br /><br /><br />Ať objednávky rostou,<br /><br /><img alt="Petr a Katka z app" height="95" src="https://s3-eu-west-1.amazonaws.com/se20-account-data/127760/media/petr-katka-podpis-2020.jpg?2w4bw91b" width="200" /><br />Petr a Katka z app.cz<br /><br /><br /></span></span><table border="0" cellpadding="0" cellspacing="0" width="100%"><tbody><tr><td align="center"><hr /><p><span style="font-size:12px;"><span style="font-family:Arial,Helvetica,sans-serif;">E-mail: <a rel="noreferrer">info@app.cz</a> | Tel: +420 608 915 592  |  app s.r.o., IČO: 07602677, DIČ: CZ07602677, Rybná 716/24, Praha 1 – Staré Město, 110 00</span></span></p><hr /></td></tr><tr><td align="center"><p><span style="font-size:12px;"><span style="font-family:Arial,Helvetica,sans-serif;">Zprávu jste obdrželi na základě registrace vašeho e-mailu pro zasílání výsledků statistik A/B testů z aplikace app.cz</span></span></p></td></tr></tbody></table></body></html>'

            //html: "<b>Ukončení AB testu</b><div></div>" // html body
        });
       // console.log("Email Message sent: %s", email, info.messageId);
    });
}

function myPromise(ms, callback) {
    return new Promise(function(resolve, reject) {
        // Set up the real work
        callback(resolve, reject);

        // Set up the timeout
        setTimeout(function() {
            reject('Promise timed out after ' + ms + ' ms');
        }, ms);
    });
}
// example use
//timedPromise(2000, function(resolve, reject) {Real work is here});

// Run every 6 hours 
//cron.schedule('*/5 * * * *', () => {
cron.schedule('0 0-23/6 * * *', () => {
  return db.HeurekaApiKeys.findAll({
    attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('heurekaAPIkey')), 'apiKey'],'country','isvalid'],
    raw: true
  }).then(heurekaapikeys => {
    var keys = [];
    var promises = [];
    for (var i = 0; i < heurekaapikeys.length; i++) {
      if (heurekaapikeys[i]['isvalid'] && heurekaapikeys[i]['apiKey'] && keys.indexOf(heurekaapikeys[i]['apiKey']) == -1) {
        promises.push(updateReviews(heurekaapikeys[i]['apiKey'],heurekaapikeys[i]['country']));
        keys.push(heurekaapikeys[i]['apiKey']);
      }
    }
    return Promise.all(promises).then(values => {
      //console.log(values);
    });
  }).catch(err => {
    console.log(err);
  });
});

// Run every 2 hours
cron.schedule('*/5 * * * *', () => {
//cron.schedule('0 0-23/2 * * *', () => {
  return db.ZboziApiKeys.findAll({
    attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('zboziAPIkey')), 'apiKey'],'idProvozovny','isvalid'],
    raw: true
  }).then(zboziapikeys => {
    var keys = [];
    var promises = [];
    for (var i = 0; i < zboziapikeys.length; i++) {
      if (zboziapikeys[i]['apiKey'] && keys.indexOf(zboziapikeys[i]['apiKey']) == -1) {
        promises.push(updateZboziReviews(zboziapikeys[i]['idProvozovny'],zboziapikeys[i]['apiKey'], false));
        keys.push(zboziapikeys[i]['apiKey']);
      }
    }
    return Promise.all(promises).then(values => {
      //console.log(values);
    });
  }).catch(err => {
    console.log(err);
  });
});


// Run every minute smartmail Level
cron.schedule('* * * * *', () => {
  return db.Users.findAll({
    where: {
      SmartRegComplete: false,
      SmartStamp: {
        [Sequelize.Op.lte]: moment().unix()
      },
      deadtimeExpiration: {
        [Sequelize.Op.gte]: moment().unix()
      }
    },
    attributes: ['email', 'Level'],
    raw: true
  }).then(users => {
    var promises = [];
    for (var i = 0; i < users.length; i++) {
      promises.push(updateLevel(users[i]['email'], users[i]['Level']));
    }
    return Promise.all(promises).then(values => {
      //console.log(values);
    });
  }).catch(err => {
    console.log(err);
  });
});

// Run every minute smartmail credit
cron.schedule('* * * * *', () => {
  return db.CreditStatus.findAll({
    include: [{
        model: db.Users,
       // where: { uuid: Sequelize.col('credit_status.uuid') },
        attributes: ['uuid','email'],
        raw: true
    }],
    where: {
      processed: 0
    },
    order: [
        ['id', 'DESC'],
    ],
    attributes: ['percent_variant'],
    raw: true
  }).then(credits => {
    //console.log(credits);
    var promises = [];
    for (var i = 0; i < credits.length; i++) {
      var level = (credits[i]['percent_variant'] == 75 ) ? 95 : (credits[i]['percent_variant'] == 90 ) ? 96 : 97;
      promises.push(updateCredit(credits[i]['user.email'], credits[i]['user.uuid'], level));
    }
    return Promise.all(promises).then(values => {
      //console.log(values);
    });
  }).catch(err => {
    console.log(err);
  });
});

function updateCredit(mail, uuid, level) {
  return new Promise((resolve, reject) => {
      email.creditCreateOrUpdate(mail, uuid, level).then(updateduuid => {
      return db.CreditStatus.update({
        processed: true
      }, {
        where: {
          uuid: updateduuid,
          processed: 0 
        }
      }).then(credit => {
        resolve(credit);
      });
    }).catch(err => {
      reject(err);
    });
  });
}

function updateZboziReviews(idProvozovny, apiKey,firstLoad){
  return new Promise((resolve, reject) => {
    db.Zbozi.findOne({
      where: {
        apiKey: apiKey
      },
      order: [
        ['timestamp', 'DESC'],
      ],
      attributes: ['timestamp']
    }).then(ts => {
        var zboziapi = null;
        if (firstLoad){
          zboziapi = axios.create({
            baseURL: cfg.zbozi.api+'?timestampFrom='+moment().add(-5, 'months').unix()+'&limit='+cfg.zbozi.limit,
            timeout: cfg.zbozi.timeout,
            auth: {
              username: idProvozovny,
              password: apiKey
            }
          });
        } else {
          zboziapi = axios.create({
            baseURL: cfg.zbozi.api+'?limit='+cfg.zbozi.limit,
            timeout: cfg.zbozi.timeout,
            auth: {
              username: idProvozovny,
              password: apiKey
            }
          });
        }
        zboziapi.get().then(response => {
          if (response.status === 200) {
            var result = [];
            var reviews = response.data.data;
            for (var review in reviews) {
              var r = {
                apiKey: apiKey,
                timestamp: response.data.data[review].createTimestamp,
                rating: response.data.data[review].ratingStars,
                positiveComments: response.data.data[review].positiveComments.substr(0, 4000),
                productName: unescape(response.data.data[review].productData.cartProductName.replace(/&quot;/g, '"')).substr(0, 2000)
              };

              if (ts === null && (r.productName !== null || r.positiveComments !== null)) {
                result.push(r);
              } 
              else if (ts !== null && (r.productName !== null || r.positiveComments !== null)) {
                if (response.data.data[review].createTimestamp > ts.dataValues.timestamp) {result.push(r);}
              }
            }
            result.sort(function(a, b) {
              if (a.timestamp < b.timestamp) {
                return -1;
              }
              if (a.timestamp > b.timestamp) {
                return 1;
              }
              return 0;
            });
            db.ZboziApiKeys.update({ lastCheck: new Date(Date.now() + 7200000).toISOString() }, {
                where: {
                    zboziAPIkey: apiKey,
                    idProvozovny: idProvozovny
                }
            }).then(zboziapikeys => {

            });
            db.Zbozi.bulkCreate(result).then(res => {
                setTimeout(() => { cycleCallinsertZboziShop(idProvozovny, apiKey, firstLoad); resolve(res); }, 5000);
              //resolve(res);
            }).catch(err => {
                setTimeout(() => { cycleCallinsertZboziShop(idProvozovny, apiKey, firstLoad); reject(err); }, 5000);
              //reject(err);
            });
          } else { //error download
              setTimeout(() => { cycleCallinsertZboziShop(idProvozovny, apiKey, firstLoad); reject(err); }, 5000);
            //console.log(response.status);
          }
        }).catch(function(err) {
            setTimeout(() => { cycleCallinsertZboziShop(idProvozovny, apiKey, firstLoad); reject(err); }, 5000);
          //reject(err);
        });
    }).catch(err => {
        setTimeout(() => { cycleCallinsertZboziShop(idProvozovny, apiKey, firstLoad); }, 5000);
    });
  }).catch(err => {
      /*db.ZboziApiKeys.update({ lastCheck: new Date(Date.now() + 7200000).toISOString() }, {
          where: {
              zboziAPIkey: apiKey,
              idProvozovny: idProvozovny
          }
      }).then(zboziapikeys => {

      });*/
      setTimeout (()=>{cycleCallinsertZboziShop(idProvozovny, apiKey,firstLoad);},5000);
      console.log("shopReviewErr",apiKey);
  });
}

function cycleCallinsertZboziShop(idProvozovny, apiKey,firstLoad){
  if (!firstLoad){
    setTimeout (function(){insertZboziShop(idProvozovny, apiKey,firstLoad,0);},5000);
    setTimeout (function(){updateRatingZboziShop(idProvozovny, apiKey);},15000);
  }
  else{
    for (let i = -13;i <= 0; i++){
      setTimeout (function(){insertZboziShop(idProvozovny, apiKey, firstLoad, i);},10000*(i+14));
    }
    setTimeout (function(){updateRatingZboziShop(idProvozovny, apiKey);},10000*15);
  }
}


function insertZboziShop(idProvozovny, apiKey, firstLoad, monthBack){
  return new Promise((resolve, reject) => {
    db.ZboziShop.findOne({
      where: {
        apiKey: apiKey
      },
      order: [
        ['timestamp', 'DESC'],
      ],
      attributes: ['timestamp']
    }).then(ts => {
        var zboziapishop = null;
        if (firstLoad){
          zboziapishop = axios.create({
            baseURL: cfg.zbozi.apiShop+'?timestampFrom='+moment().add(monthBack-1, 'months').unix()+'&timestampTo='+moment().add(monthBack, 'months').unix()+'&limit='+cfg.zbozi.limitShop,
            timeout: cfg.zbozi.timeout,
            auth: {
              username: idProvozovny,
              password: apiKey
            }
          });
        } else {
          zboziapishop = axios.create({
            baseURL: cfg.zbozi.apiShop+'?limit='+cfg.zbozi.limitShop,
            timeout: cfg.zbozi.timeout,
            auth: {
              username: idProvozovny,
              password: apiKey
            }
          });
        }
        zboziapishop.get().then(response => {
          if (response.status === 200) {
            var shopResult = [];
            var shopReviews = response.data.data;
            for (var shopReview in shopReviews ) {
              var r = {
                apiKey: apiKey,
                timestamp: response.data.data[shopReview ].createTimestamp,
                positiveComments: (response.data.data[shopReview].positiveComment === undefined)?null:(response.data.data[shopReview].positiveComment === '')?null:response.data.data[shopReview].positiveComment.substr(0, 4000)
              };
              if (ts === null && r.positiveComments != null) {
                shopResult.push(r);
              }else if (ts !== null && r.positiveComments !== null) {
                if (response.data.data[shopReview].createTimestamp > ts.dataValues.timestamp) {shopResult.push(r);}
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
            db.ZboziApiKeys.update({ lastCheck: new Date(Date.now() + 7200000).toISOString() }, {
                where: {
                    zboziAPIkey: apiKey,
                    idProvozovny: idProvozovny
                }
            }).then(zboziapikeys => {

            });
            db.ZboziShop.bulkCreate(shopResult).then(res => {
              resolve(res);
            }).catch(err => {
              reject(err);
            });
          } else { //error download
            //console.log(response);
            reject('no_data');
          }
        }).catch(function(err) {
          reject(err);
        });
    }).catch(err => {
       reject(err);
    });
  });
}


function updateRatingZboziShop(idProvozovny, apiKey){
  return new Promise((resolve, reject) => {
        const zboziapishop = axios.create({
          baseURL: cfg.zbozi.apiShopRating+idProvozovny,
          auth: {
            username: idProvozovny,
            password: apiKey
          }
        });

        zboziapishop.get().then(response => {
          if (response.status === 200) {
            var shopReviews = response.data.data;
            var shopRatingResult = (shopReviews[0].rating == undefined)?null:(shopReviews[0].rating == '')?null:shopReviews[0].rating;
            db.ZboziShop.update({
              rating: shopRatingResult
              }, {
              where: {
                apiKey: apiKey
              }
            }).then(res => {
              resolve(res);
            }).catch(err => {
              reject(err);
            });
          } else { //error download
            //console.log(response.status);
            reject('no_data');
          }
        }).catch(function(err) {
          reject(err);
        });
  }).catch(err => {
      console.log("shopUpdateRatingReviewTotalErr",apiKey);
  });
}


function updateReviews(apiKey, country) {
  return new Promise((resolve, reject) => {
    db.Reviews.findOne({
      where: {
        apiKey: apiKey
      },
      order: [
        ['timestamp', 'DESC'],
      ],
      attributes: ['timestamp']
    }).then(ts => {

      var reviewsURL ='';
      if (country =='SK'){reviewsURL = new URL(cfg.heurekaSK);} else {reviewsURL = new URL(cfg.heurekaCZ);}

      reviewsURL.searchParams.set('key', apiKey);
        if (ts !== null) {
          var dt = moment.unix(ts.dataValues.timestamp).format('YYYY-MM-DD hh:mm:ss');
          reviewsURL.searchParams.set('from', dt);
        }
      axios.get(reviewsURL.href).then(response => {
        var result = [];
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
                          apiKey: apiKey,
                          timestamp: reviews[review]['unix_timestamp'],
                          rating: reviews[review]['total_rating'],
                      };
                      if ('summary' in reviews[review]) {
                          r['summary'] = reviews[review]['summary'].substr(0, 4000);
                      }
                      if ('pros' in reviews[review]) {
                          r['pros'] = reviews[review]['pros'].substr(0, 4000);
                      }
                      if (ts === null && ('pros' in r || 'summary' in r)) {
                          result.push(r);
                      }
                      else if (ts !== null && ('pros' in r || 'summary' in r)) {
                          if (reviews[review]['unix_timestamp'] > ts.dataValues.timestamp) { result.push(r); }
                      }
                  }
              }
              result.sort(function (a, b) {
                  if (a.timestamp < b.timestamp) {
                      return -1;
                  }
                  if (a.timestamp > b.timestamp) {
                      return 1;
                  }
                  return 0;
              });
          }
          db.HeurekaApiKeys.update({
              lastCheck: new Date(Date.now() + 7200000).toISOString(),
              lastScore: Sequelize.literal('IFNULL((SELECT CAST(AVG(ri.rating) AS DECIMAL(2,1)) FROM reviews ri WHERE ri.apiKey = "' + apiKey+'" AND ri.TIMESTAMP >= (UNIX_TIMESTAMP(CURRENT_TIMESTAMP) - (90*24*3600))),0)')
          }, {
            where: {
                heurekaAPIkey: apiKey,
                country: country
            }
        }).then(heurekaapikeys => {

        });

        db.Reviews.bulkCreate(result).then(res => {
          resolve(res);
        }).catch(err => {
          reject(err);
        });
      }).catch(err => {
        reject(`${err.response} - ${apiKey}`);
      });
    }).catch(err => {
        db.HeurekaApiKeys.update({
            lastCheck: new Date(Date.now() + 7200000).toISOString(),
            lastScore: Sequelize.literal('IFNULL((SELECT CAST(AVG(ri.rating) AS DECIMAL(2,1)) FROM reviews ri WHERE ri.apiKey = "' + apiKey + '" AND ri.TIMESTAMP >= (UNIX_TIMESTAMP(CURRENT_TIMESTAMP) - (90*24*3600))),0)')
        }, {
            where: {
                heurekaAPIkey: apiKey,
                country: country
            }
        }).then(heurekaapikeys => {

        });
      reject(err);
    });
  });
}

function updateLevel(mail, level) {
  return new Promise((resolve, reject) => {
    email.contactCreateOrUpdate(mail, level).then(updated => {
      return db.Users.update({
        SmartRegComplete: true
      }, {
        where: {
          email: updated
        }
      }).then(users => {
        resolve();
      });
    }).catch(err => {
      reject(err);
    });
  });
}

function replaceGeo(geo, country) {
    switch (country) {
        case "cs":
            for (var i = 0; i < czechCityNames.length; i++) {
                if (czechCityNames[i][0].localeCompare(geo, 'cs', { sensitivity: 'base' }) === 0) {
                    return czechCityNames[i][1];
                }
            }
            break;
        case "sk":
            for (var i = 0; i < slovakCityNames.length; i++) {
                if (slovakCityNames[i][0].localeCompare(geo, 'sk', { sensitivity: 'base' }) === 0) {
                    return slovakCityNames[i][1];
                }
            }
            break;
        case "en":
            if (geo.length > 0) {
                return geo;
            }
            break;
        default:
            for (var i = 0; i < czechCityNames.length; i++) {
                if (czechCityNames[i][0].localeCompare(geo, 'cs', { sensitivity: 'base' }) === 0) {
                    return czechCityNames[i][1];
                }
            }
    }
    return null;
}

function findName(name, country) {
    switch (country) {
        case "cs":
            for (var i = 0; i < czechNames.length; i++) {
                if (czechNames[i].localeCompare(name, 'cs', { sensitivity: 'base' }) === 0) {
                    return czechNames[i];
                }
            }
            break;
        case "sk":
            for (var i = 0; i < slovakNames.length; i++) {
                if (slovakNames[i].localeCompare(name, 'sk', { sensitivity: 'base' }) === 0) {
                    return slovakNames[i];
                }
            }
            break;
        case "en":
            for (var i = 0; i < englishNames.length; i++) {
                if (englishNames[i].localeCompare(name, 'en', { sensitivity: 'base' }) === 0) {
                    return englishNames[i];
                }
            }
            break;
        default:
            for (var i = 0; i < czechNames.length; i++) {
                if (czechNames[i].localeCompare(name, 'cs', { sensitivity: 'base' }) === 0) {
                    return czechNames[i];
                }
            }
    }
  return null;
}

function isEmail(e) {
  if (e) {
    var t = e.trim();
    return !(t.indexOf(' ') >= 0 || '' === e || !/^[^@]+@[^@.]+\.[^@]*\w\w$/.test(t) || e.match(/[\(\)\<\>\,\;\:\\\'\[\]]/));
  }
  return false;
}

function parseForm(id, f, geo, country) {
  try {
    var form = JSON.parse(f);
  } catch (e) {
    return;
  }
  var name, emailName;
  var update = {};
  for (var field in form) {
    if (emailName == null && typeof form[field] === 'string' && isEmail(form[field])) {
      emailName = findName(form[field].split('@')[0].split('.')[0], country);
    } else if (name == null && typeof form[field] === 'string') {
        name = findName(form[field].split(' ')[0], country);
    }
    if (name !== null || emailName !== null) {
      update['name'] = name || emailName;
    }
  }
  var g = replaceGeo(geo,country);
  if (g !== null) {
    update['geo'] = g;
  }
  if (Object.keys(update).length > 0) {
    return db.Forms.update(update, {
      where: {
        id: id
      }
    }).then(res => {
      //
    }).catch(err => {
      return console.log(err);
    });
  }
}

function hasChanges(database, table, updates) {
  var promises = [];
  for (var i = 0; i < updates.length; i++) {
    if (updates[i].changes.indexOf('heurekaAPIkey') > -1 && updates[i].row['heurekaAPIkey'] !== null && updates[i].row['heurekaAPIkey'].length === 32) {
      promises.push(updateReviews(updates[i].row['heurekaAPIkey'],updates[i].row['country']));
    }
    if (updates[i].changes.indexOf('Level') > -1 && !updates[i].row['SmartRegComplete'] && moment().unix() > updates[i].row['SmartStamp']) {
      promises.push(updateLevel(updates[i].row['email'], updates[i].row['Level']));
    }
    if (table == 'abTesting') {
        if (updates[i].changes.indexOf('active') > -1 && updates[i].row['active'] == 0 && updates[i].row['sendEmail'] == 1 && new Date(new Date(updates[i].row['startDateTime']).getTime() + 2 * 3600000).getTime() < new Date(Date.now() - 2 * 86400000 + 7200000).getTime()) {
        promises.push(sendAbtestEndedMail(updates[i].row['id']));
        }
    }
  }
  Promise.all(promises).then(values => {
    //console.log(values);
  }).catch(err => {
    return console.log(err);
  });
}

function updatedRows(database, table, rows) {
  var updates = rows.map(function(row) {
    var changed = [];
    for (var val in row['before']) {
      if (row['before'][val] !== row['after'][val]) {
        changed.push(val);
      }
    }
      return { changes: changed, rowBefore: row['before'] , row: row['after'] };
  });
  hasChanges(database, table, updates);
}

function writtenRows(database, table, rows) {
  var promises = [];
  for (var i = 0; i < rows.length; i++) {
      if (table === 'zboziapikeys') {
          promises.push(updateZboziReviews(rows[i]['idProvozovny'], rows[i]['zboziAPIkey'], true));
      } else if (table === 'heurekaapikeys') {
          updateReviews(rows[i]['heurekaAPIkey'], rows[i]['country']);
      } else if (table === 'users') {
          promises.push(updateLevel(rows[i]['email'], rows[i]['Level']));
      } else if (table === 'forms' && 'form' in rows[i] && Object.keys(rows[i].form).length > 0) {
          parseForm(rows[i].id, rows[i].form, rows[i].geo, rows[i].country);
      } else if (table === 'abTesting') {
          promises.push(sendAbtestStartedMail(rows[i].id));
      }
  }
  Promise.all(promises).then(values => {
    //console.log(values);
  }).catch(err => {
    return console.log(err);
  });
}

// Each change to the replication log results in an event
zongji.on('binlog', function(evt) {
  if (evt.getEventName() === 'updaterows') {
    return updatedRows(evt.tableMap[evt.tableId]['parentSchema'], evt.tableMap[evt.tableId]['tableName'], evt.rows);
  } else if (evt.getEventName() === 'writerows') {
    return writtenRows(evt.tableMap[evt.tableId]['parentSchema'], evt.tableMap[evt.tableId]['tableName'], evt.rows);
  }
});

// Binlog must be started, optionally pass in filters
zongji.start({
  startAtEnd: true,
  includeEvents: ['tablemap', 'writerows', 'updaterows'],
  excludeEvents: ['xid', 'format', 'rotate', 'intvar', 'query', 'unknown'],
  includeSchema: {
      'saaspixel': ['users', 'forms', 'heurekaapikeys', 'zboziapikeys', 'creditstatus','abTesting']
  },
  excludeSchema: {
    'saaspixel': ['visits', 'visitors', 'sessions', 'reviews', 'zbozi','zbozishop', 'login_history', 'campaigns', 'appsettings','userdomains','userurls']
  }
});

process.on('SIGINT', function() {
  console.log('Got SIGINT.');
  zongji.stop();
  process.exit();
});
