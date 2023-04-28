module.exports = (sequelize, type) => {
  return sequelize.define('online', {
    id: {
      type: type.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    visitorID: {
      type: type.STRING(32),
      allowNull: false,
      unique: true
    },
    url: {
      type: type.STRING(2048),
      allowNull: false
    },
    lastActivity: {
      type: type.INTEGER(11),
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
    }
  }, {
    freezeTableName: true,
    timestamps: false
  });
};
