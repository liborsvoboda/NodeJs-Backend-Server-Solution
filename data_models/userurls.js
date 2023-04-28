module.exports = (sequelize, type) => {
  return sequelize.define('userurls', {
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
    domain: {
      type: type.STRING(255),
      allowNull: true
    },
    url: {
      type: type.STRING(2048),
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
