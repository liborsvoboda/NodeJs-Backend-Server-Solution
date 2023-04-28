module.exports = (sequelize, type) => {
  return sequelize.define('abTesting', {
    id: {
        type: type.INTEGER.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
    },
    uuid: {
        type: type.UUID,
        allowNull: false
    },
    active: {
        type: type.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    activateNow: {
        type: type.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    name: {
        type: type.STRING(70),
        allowNull: false
    },
    selectedDomain: {
        type: type.STRING(255),
        allowNull: false
    },
    targetUrlsNames: {
        type: type.STRING(255),
        allowNull: false
     },
    campaignRatio: {
        type: type.STRING(255),
        allowNull: false
    },
    targetUrls: {
        type: type.STRING(4096),
        allowNull: false
    },
    selectedCampaignIds: {
        type: type.STRING(50),
        allowNull: false
    },
    campaignDeactivate: {
        type: type.STRING(255),
        allowNull: false
    },
    targetParamIgnore: {
        type: type.STRING(255),
        allowNull: false
    },
    dayCount: {
        type: type.INTEGER,
        allowNull: true
    },
    startDateTime: {
        type: type.DATE,
        allowNull: true
    },
    endDateTime: {
        type: type.DATE,
        allowNull: true
    },
    sendEmail: {
        type: type.BOOLEAN,
        defaultValue: true,
        allowNull: false
    },
    emailAddress: {
        type: type.STRING(150),
        allowNull: true
    },
    emailAddresses: {
        type: type.STRING(1024),
        allowNull: true
    }
  }, {
    indexes: [
      {
        name: 'UUID_isActive',
        fields: ['uuid', 'active']
      }
    ],
    freezeTableName: true,
    timestamps: false
  });
};
