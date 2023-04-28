module.exports = (sequelize, type) => {
  return sequelize.define('zbozishop', {
    id: {
      type: type.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    apiKey: {
      type: type.STRING(64),
      allowNull: false
    },
    rating: {
      type: type.DECIMAL(4, 1),
      allowNull: true
    },
    timestamp: {
      type: type.INTEGER(11),
      allowNull: false
    },
    positiveComments: {
      type: type.STRING(4096),
      allowNull: false
    }
  }, {
    indexes: [
      {
        unique: true,
        name: 'APIkey_Rating_Timestamp',
        fields: ['apikey', 'timestamp']
      }
    ],
    freezeTableName: true,
    timestamps: false
  });
};
