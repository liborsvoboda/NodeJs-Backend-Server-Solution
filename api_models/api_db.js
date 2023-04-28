const Sequelize = require('sequelize');
const moment = require('moment');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const UsersModel = require('../data_models/users');
const SessionsModel = require('../data_models/sessions');
const CampaignsModel = require('../data_models/campaigns');
const LoginHistoryModel = require('../data_models/login_history');
const VisitorsModel = require('../data_models/visitors');
const VisitsModel = require('../data_models/visits');
const FormsModel = require('../data_models/forms');
const ReviewsModel = require('../data_models/reviews');
const AppsettingsModel = require('../data_models/appsettings');
const HeurekaApiKeysModel = require('../data_models/heurekaapikeys');
const ZboziApiKeysModel = require('../data_models/zboziapikeys');
const UserDomainsModel = require('../data_models/userdomains');
const UserUrlsModel = require('../data_models/userurls');
const TopVariablesModel = require('../data_models/topvariables');
const TopValuesModel = require('../data_models/topvalues');
const AbTestingModel = require('../data_models/abtesting');
const NotificationsDictionaryModel = require('../data_models/notificationsDictionary');
const SharedvisitorsABModel = require('../data_models/sharedvisitorsAB');
const ShoptetCodesABModel = require('../data_models/shoptetCodes');

const cfg = JSON.parse(fs.readFileSync(path.join('./api_config/api_config.json'), 'utf8'));
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
  dialectOptions: {
    dateStrings: true,
    typeCast: true
  },
  keepDefaultTimezone: true
});

const Users = UsersModel(sequelize, Sequelize);
const Sessions = SessionsModel(sequelize, Sequelize);
const Campaigns = CampaignsModel(sequelize, Sequelize);
const LoginHistory = LoginHistoryModel(sequelize, Sequelize);
const Visitors = VisitorsModel(sequelize, Sequelize);
const Visits = VisitsModel(sequelize, Sequelize);
const Forms = FormsModel(sequelize, Sequelize);
const Reviews = ReviewsModel(sequelize, Sequelize);
const Appsettings = AppsettingsModel(sequelize, Sequelize);
const HeurekaApiKeys = HeurekaApiKeysModel(sequelize, Sequelize);
const ZboziApiKeys = ZboziApiKeysModel(sequelize, Sequelize);
const UserDomains = UserDomainsModel(sequelize, Sequelize);
const UserUrls = UserUrlsModel(sequelize, Sequelize);
const TopVariables = TopVariablesModel(sequelize, Sequelize);
const TopValues = TopValuesModel(sequelize, Sequelize);
const AbTesting = AbTestingModel(sequelize, Sequelize);
const NotificationsDictionary = NotificationsDictionaryModel(sequelize, Sequelize);
const SharedvisitorsAB = SharedvisitorsABModel(sequelize, Sequelize);
const ShoptetCodes = ShoptetCodesABModel(sequelize, Sequelize);

var hooks = {
  user: (instance, options) => {
    if (instance.changed('password')) {
      return bcrypt.hash(instance.get('password'), cfg.server.bcrypt.rounds).then(hash => {
        return instance.set('password', hash);
      });
    }
  },
  session: (instance, options) => {
    if (instance !== null && 'dataValues' in instance && 'session' in instance.dataValues && 'ip' in instance.dataValues) {
      return Sessions.update({ lastActivity: moment().unix() }, { where: { session: instance.dataValues.session, ip: instance.dataValues.ip }}).then((result) => {
        return result;
      }).catch(err => {
        throw new Error(err);
      });
    }
  }
};

Users.prototype.comparePassword = function(password) {
  return new Promise(resolve => {
    bcrypt.compare(password, this.password, (err, res) => {
      resolve(res);
    });
  });
};
Users.beforeCreate(hooks.user);
Users.beforeUpdate(hooks.user);
Users.belongsTo(Reviews, {
  foreignKey: 'heurekaAPIkey',
  targetKey: 'apiKey',
  onDelete: 'CASCADE'
});

Campaigns.belongsTo(HeurekaApiKeys, {
  foreignKey: 'heurekaAPIkey',
  targetKey: 'heurekaAPIkey',
  onDelete: 'CASCADE'
});

Campaigns.belongsTo(ZboziApiKeys, {
  foreignKey: 'zboziAPIkey',
  targetKey: 'zboziAPIkey',
  onDelete: 'CASCADE'
});

Sessions.afterFind(hooks.session);
Sessions.belongsTo(Users, {
  foreignKey: 'uuid',
  targetKey: 'uuid',
  onDelete: 'CASCADE'
});
Campaigns.belongsTo(Users, {
  foreignKey: 'uuid',
  targetKey: 'uuid',
  onDelete: 'CASCADE'
});
AbTesting.belongsTo(Users, {
    foreignKey: 'uuid',
    targetKey: 'uuid',
    onDelete: 'CASCADE'
});

AbTesting.hasMany(SharedvisitorsAB, {
    foreignKey: 'abTestId',
    targetKey: 'id',
    onDelete: 'CASCADE'
});

UserDomains.belongsTo(Users, {
  foreignKey: 'uuid',
  targetKey: 'uuid',
  onDelete: 'CASCADE'
});
UserUrls.belongsTo(Users, {
  foreignKey: 'uuid',
  targetKey: 'uuid',
  onDelete: 'CASCADE'
});
LoginHistory.belongsTo(Users, {
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

// create all the defined tables in the specified database
sequelize.sync().then(() => {
  console.log('DB tables OK');
  if (cfg.server.db.testUser) {
    return Users.findOrCreate({
      where: {
        email: 'test@test.com'
      },
      defaults: {
        uuid: '3ec287bf-a263-469f-b524-95f4f82fa82d',
        email: 'test@test.com',
        password: '123456',
        Name: 'Test',
        Surename: 'Testov',
        City: 'Přerov',
        StreetACP: 'Test street 13',
        Postcode: '1234567890',
        Telephone: '1234567890',
        Company: '',
        Dic: '12345678901234567890',
        Ico: '1234567890',
        StepProfileFinished: true,
        RegEmail: 'test@test.com',
        SmartStamp: moment().unix(),
        NextPayDate: moment().add(14, 'days').format('YYYY-MM-DD'),
        NextPayDate_ts: moment().add(14, 'days').unix(),
        CreditNextPayDate: moment().add(14, 'days').format('YYYY-MM-DD'),
        CreditNextPayDate_ts: moment().add(14, 'days').unix(),
        RegisterDate: moment().format('YYYY-MM-DD'),
        StepHelpFinished: true,
        heurekaAPIkey: '12345678901234567890123456789012',
        StepHeurekaFinished: true,
        StepTeamFinished: true,
        deadtimeExpiration: moment().add(1, 'months').unix()
      }
    }).then(user => {
      return console.log('Test user added');
    }).catch(err => {
      throw new Error(err);
    });
  }
}).catch(err => {
  return console.log(err);
});

// export models
module.exports.Users = Users;
module.exports.Sessions = Sessions;
module.exports.Campaigns = Campaigns;
module.exports.LoginHistory = LoginHistory;
module.exports.Visitors = Visitors;
module.exports.Visits = Visits;
module.exports.Forms = Forms;
module.exports.Reviews = Reviews;
module.exports.Appsettings = Appsettings;
module.exports.Op = Sequelize.Op;
module.exports.HeurekaApiKeys = HeurekaApiKeys;
module.exports.ZboziApiKeys = ZboziApiKeys;
module.exports.UserDomains = UserDomains;
module.exports.UserUrls = UserUrls;
module.exports.TopVariables = TopVariables;
module.exports.TopValues = TopValues;
module.exports.AbTesting = AbTesting;
module.exports.NotificationsDictionary = NotificationsDictionary;
module.exports.SharedvisitorsAB = SharedvisitorsAB;
module.exports.ShoptetCodes = ShoptetCodes;
