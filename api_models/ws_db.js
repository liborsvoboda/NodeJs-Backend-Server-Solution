const Sequelize = require('sequelize');
const fs = require('fs');
const path = require('path');
const UsersModel = require('../data_models/users');
const CampaignsModel = require('../data_models/campaigns');
const VisitorsModel = require('../data_models/visitors');
const VisitsModel = require('../data_models/visits');
const FormsModel = require('../data_models/forms');
const ReviewsModel = require('../data_models/reviews');
const OnlineModel = require('../data_models/online');
const HeurekaApiKeysModel = require('../data_models/heurekaapikeys');
const ZboziProductModel = require('../data_models/zbozi');
const ZboziApiKeysModel = require('../data_models/zboziapikeys');
const ZboziShopModel = require('../data_models/zbozishop');
const NotificationsDictionaryModel = require('../data_models/notificationsDictionary');


const cfg = JSON.parse(fs.readFileSync(path.join('./api_config/ws_config.json'), 'utf8'));
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

const Users = UsersModel(sequelize, Sequelize);
const Campaigns = CampaignsModel(sequelize, Sequelize);
const Visitors = VisitorsModel(sequelize, Sequelize);
const Visits = VisitsModel(sequelize, Sequelize);
const Forms = FormsModel(sequelize, Sequelize);
const Reviews = ReviewsModel(sequelize, Sequelize);
const Online = OnlineModel(sequelize, Sequelize);
const HeurekaApiKeys = HeurekaApiKeysModel(sequelize, Sequelize);
const ZboziProduct = ZboziProductModel(sequelize, Sequelize);
const ZboziApiKeys = ZboziApiKeysModel(sequelize, Sequelize);
const ZboziShop = ZboziShopModel(sequelize, Sequelize);
const NotificationsDictionary = NotificationsDictionaryModel(sequelize, Sequelize);

Campaigns.belongsTo(HeurekaApiKeys, {
    foreignKey: 'heurekaAPIkey',
    targetKey: 'heurekaAPIkey',
    onDelete: 'CASCADE'
});
Campaigns.belongsTo(ZboziProduct, {
  foreignKey: 'zboziAPIkey',
  targetKey: 'apiKey',
  onDelete: 'CASCADE'
});
Campaigns.belongsTo(ZboziShop, {
  foreignKey: 'zboziAPIkey',
  targetKey: 'apiKey',
  onDelete: 'CASCADE'
});
Campaigns.belongsTo(Reviews, {
  foreignKey: 'heurekaAPIkey',
  targetKey: 'apiKey',
  onDelete: 'CASCADE'
});
Campaigns.belongsTo(Users, {
  foreignKey: 'uuid',
  targetKey: 'uuid',
  onDelete: 'CASCADE'
});
Visits.belongsTo(Users, {
  foreignKey: 'uuid',
  targetKey: 'uuid',
  onDelete: 'CASCADE'
});
Visits.belongsTo(Visitors, {
  foreignKey: 'visitorID',
  targetKey: 'visitorID',
  onDelete: 'CASCADE'
});
Visitors.hasMany(Visits, {
  foreignKey: 'visitorID',
  sourceKey: 'visitorID',
  onDelete: 'CASCADE'
});
Visitors.hasMany(Forms, {
  foreignKey: 'visitorID',
  sourceKey: 'visitorID',
  onDelete: 'CASCADE'
});
Forms.belongsTo(Users, {
  foreignKey: 'uuid',
  targetKey: 'uuid',
  onDelete: 'CASCADE'
});
Forms.belongsTo(Visitors, {
  foreignKey: 'visitorID',
  targetKey: 'visitorID',
  onDelete: 'CASCADE'
});
Online.belongsTo(Visitors, {
  foreignKey: 'visitorID',
  targetKey: 'visitorID',
  onDelete: 'CASCADE'
});

// create all the defined tables in the specified database
sequelize.sync().then(() => {
  console.log('DB tables OK');
}).catch(err => {
  console.log(err);
});

// export models
module.exports.Users = Users;
module.exports.Campaigns = Campaigns;
module.exports.Visitors = Visitors;
module.exports.Visits = Visits;
module.exports.Forms = Forms;
module.exports.Reviews = Reviews;
module.exports.Online = Online;
module.exports.HeurekaApiKeys = HeurekaApiKeys;
module.exports.ZboziProduct = ZboziProduct;
module.exports.ZboziApiKeys = ZboziApiKeys;
module.exports.ZboziShop = ZboziShop;
module.exports.NotificationsDictionary = NotificationsDictionary;
