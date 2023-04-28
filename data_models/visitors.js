module.exports = (sequelize, type) => {
  return sequelize.define('visitors', {
    visitorID: {
      type: type.STRING(32),
      primaryKey: true,
      allowNull: false
    },
    userAgent: {
      type: type.STRING,
      allowNull: false
    },
    system: {
      type: type.STRING,
      allowNull: true
    },
    language: {
      type: type.STRING,
      allowNull: true
    },
    screenWidth: {
      type: type.INTEGER,
      allowNull: true
    },
    screenHeight: {
      type: type.INTEGER,
      allowNull: true
    },
    isMobile: {
      type: type.BOOLEAN,
      allowNull: false
    }
  }, {
    freezeTableName: true,
    timestamps: false
  });
};
