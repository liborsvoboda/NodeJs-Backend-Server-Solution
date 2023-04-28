module.exports = (sequelize, type) => {
  return sequelize.define('visits', {
    id: {
      type: type.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    uuid: {
      type: type.UUID,
      allowNull: false
    },
    visitorID: {
      type: type.STRING(32),
      allowNull: false
    },
    url: {
      type: type.STRING(2048),
      allowNull: false
    },
    referer: {
      type: type.STRING(2048),
      allowNull: true
    },
    again: {
      type: type.BOOLEAN,
      allowNull: false
    },
    domain: {
      type: type.STRING(255),
      allowNull: true
    },
    timestamp: {
      type: type.INTEGER(11),
      allowNull: false
    }
  }, {
    indexes: [
      {
        unique: false,
        name: 'UUID',
        fields: ['uuid']
      }
    ],
    freezeTableName: true,
    timestamps: false
  });
};
