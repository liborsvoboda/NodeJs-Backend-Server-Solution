module.exports = (sequelize, type) => {
    return sequelize.define('sharedvisitorsAB', {
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
    abTestId: {
        type: type.INTEGER,
        allowNull: false
    },
    campaignId: {
        type: type.INTEGER,
        allowNull: false
    },
    visitorID: {
        type: type.STRING(32),
        allowNull: false
    }
  }, {
    indexes: [
      {
        name: 'visitorID',
        fields: ['visitorID']
      }
    ],
    freezeTableName: true,
    timestamps: false
  });
};
