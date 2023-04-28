module.exports = (sequelize, type) => {
  return sequelize.define('reviews', {
    id: {
      type: type.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    apiKey: {
      type: type.STRING(32),
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
    summary: {
      type: type.STRING(4096),
      allowNull: true
    },
    pros: {
      type: type.STRING(2048),
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
