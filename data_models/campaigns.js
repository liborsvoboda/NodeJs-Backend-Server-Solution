module.exports = (sequelize, type) => {
  return sequelize.define('campaigns', {
    campaignID: {
      type: type.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    uuid: {
      type: type.UUID,
      allowNull: false
    },
    ActiveCampaign: {
      type: type.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    CampaignAdaptation: {
      type: type.STRING(1024),
      allowNull: false
    },
    CampaignName: {
      type: type.STRING(70),
      allowNull: false
    },
    selectedDomain: {
      type: type.STRING(255),
      allowNull: false
    },
    heurekaAPIkey: {
      type: type.STRING(32),
      allowNull: true
    },
    zboziAPIkey: {
      type: type.STRING(32),
      allowNull: true
    },
    CaptureRuleObj: {
      type: type.STRING(255),
      allowNull: false
    },
    CapturedUrlsObjIn: {
      type: type.TEXT('medium'),
      allowNull: false
    },
    CapturedUrlsObjOut: {
      type: type.TEXT('medium'),
      allowNull: false
    },
    CaptureRuleReg: {
      type: type.STRING(255),
      allowNull: false
    },
    CapturedUrlsRegIn: {
      type: type.TEXT('medium'),
      allowNull: false
    },
    CapturedUrlsRegOut: {
      type: type.TEXT('medium'),
      allowNull: false
    },
    CaptureRuleStat: {
      type: type.STRING(255),
      allowNull: false
    },
    CapturedUrlsStatIn: {
      type: type.TEXT('medium'),
      allowNull: false
    },
    CapturedUrlsStatOut: {
      type: type.TEXT('medium'),
      allowNull: false
    },
    Heureka: {
      type: type.STRING(128),
      allowNull: false
    },
    Zbozi: {
      type: type.STRING(1024),
      allowNull: false
    },
    LastEventsOrders: {
      type: type.STRING(255),
      allowNull: false
    },
    LastEventsRegistrations: {
      type: type.STRING(255),
      allowNull: false
    },
    SelectedNotifications: {
      type: type.STRING(128),
      allowNull: false
    },
    ShownRule: {
      type: type.STRING(255),
      allowNull: false
    },
    ShownUrlsIn: {
      type: type.TEXT('medium'),
      allowNull: false
    },
    ShownUrlsOut: {
      type: type.TEXT('medium'),
      allowNull: false
    },
    Statistics: {
      type: type.STRING(255),
      allowNull: false
    },
    VisitCount: {
      type: type.STRING(128),
      allowNull: false
    },
    OwnNotify: {
      type: type.STRING(4096),
      allowNull: false
    },
    OwnNotifyIcons: {
      type: type.TEXT,
      allowNull: false
    },
    flags: {
      type: type.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    cas: {
      type: type.BIGINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    },
    expiry: {
      type: type.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    selectedLanguage: {
      type: type.STRING(50),
      allowNull: true
    },
    ignoreDomain: {
      type: type.BOOLEAN,
      defaultValue: false,
      allowNull: true
    }
  }, {
    indexes: [
      {
        name: 'UUID_isActive',
        fields: ['uuid', 'ActiveCampaign']
      }
    ],
    freezeTableName: true,
    timestamps: false
  });
};
