const Sequelize = require('sequelize');
const fs = require('fs');
const path = require('path');
const UsersModel = require('../data_models/users');
const FormsModel = require('../data_models/forms');
const ReviewsModel = require('../data_models/reviews');
const HeurekaApiKeysModel = require('../data_models/heurekaapikeys');
const ZboziModel = require('../data_models/zbozi');
const ZboziApiKeysModel = require('../data_models/zboziapikeys');
const CreditStatusModel = require('../data_models/creditstatus');
const ZboziShopModel = require('../data_models/zbozishop');
const AbTestingModel = require('../data_models/abtesting');

const cfg = JSON.parse(fs.readFileSync(path.join('./api_config/cron_config.json'), 'utf8'));
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
const Forms = FormsModel(sequelize, Sequelize);
const Reviews = ReviewsModel(sequelize, Sequelize);
const HeurekaApiKeys= HeurekaApiKeysModel(sequelize, Sequelize);
const Zbozi= ZboziModel(sequelize, Sequelize);
const ZboziApiKeys= ZboziApiKeysModel(sequelize, Sequelize);
const CreditStatus= CreditStatusModel(sequelize, Sequelize);
const ZboziShop = ZboziShopModel(sequelize, Sequelize);
const AbTesting = AbTestingModel(sequelize, Sequelize);

CreditStatus.belongsTo(Users, {
  foreignKey: 'uuid',
  targetKey: 'uuid',
  onDelete: 'CASCADE'
});
ZboziApiKeys.belongsTo(Zbozi, {
  foreignKey: 'zboziAPIkey',
  targetKey: 'apiKey',
  onDelete: 'CASCADE'
});
ZboziApiKeys.belongsTo(ZboziShop, {
  foreignKey: 'zboziAPIkey',
  targetKey: 'apiKey',
  onDelete: 'CASCADE'
});
HeurekaApiKeys.belongsTo(Reviews, {
  foreignKey: 'heurekaAPIkey',
  targetKey: 'apiKey',
  onDelete: 'CASCADE'
});
HeurekaApiKeys.belongsTo(Reviews, {
  foreignKey: 'heurekaAPIkey',
  targetKey: 'apiKey',
  onDelete: 'CASCADE'
});
Forms.belongsTo(Users, {
  foreignKey: 'uuid',
  targetKey: 'uuid',
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
module.exports.Forms = Forms;
module.exports.Reviews = Reviews;
module.exports.HeurekaApiKeys = HeurekaApiKeys;
module.exports.Zbozi = Zbozi;
module.exports.ZboziApiKeys = ZboziApiKeys;
module.exports.CreditStatus= CreditStatus;
module.exports.ZboziShop = ZboziShop;
module.exports.AbTesting = AbTesting;

