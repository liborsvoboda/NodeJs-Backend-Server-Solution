module.exports = (sequelize, type) => {
  return sequelize.define('zbozi', {
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
      type: type.DECIMAL(2, 1),
      allowNull: false
    },
    timestamp: {
      type: type.INTEGER(11),
      allowNull: false
    },
    productName: {
      type: type.STRING(2048),
      allowNull: true
    },
    positiveComments: {
      type: type.STRING(4096),
      allowNull: true
    }
  }, {
    indexes: [
      {
        unique: false,
        name: 'APIkey_Rating_Timestamp',
        fields: ['apikey', 'rating', 'timestamp']
      }
    ],
    freezeTableName: true,
    timestamps: false
  });
};
