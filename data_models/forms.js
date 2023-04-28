module.exports = (sequelize, type) => {
  return sequelize.define('forms', {
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
    name: {
      type: type.STRING,
      defaultValue: null,
      allowNull: true
    },
    form: {
      type: type.TEXT('medium'),
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
    geo: {
      type: type.STRING,
      allowNull: false
    },
    timestamp: {
      type: type.INTEGER(11),
      allowNull: false
    },
    country: {
        type: type.STRING,
        defaultValue: null,
        allowNull: true
    }
  }, {
    indexes: [
      {
        unique: false,
        name: 'UUID_timestamp',
        fields: ['uuid', 'timestamp']
      }
    ],
    freezeTableName: true,
    timestamps: false
  });
};
